import { Injectable, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from './auth';
import { HomeworkService } from './homework.service';
import { ApiClient } from './api/api-client.service';
import { ApiPage, ApiParticipation, ApiParticipationSummary } from './api/api-models';
import { toParticipationDetail, toParticipationRecord } from './api/participation-mapping';
import { AssignmentKind, ParticipationRecord, ParticipationValidation } from '../models';
import { participationScorePercent, toCompletedQuizProgress, CompletedQuizProgress } from '../shared/participation-score';

interface QuizStats {
  completedCount: number;
  averageScore: number;
  bestScore: number;
}

/**
 * A student's participation history, summarized once and shared by every
 * screen that shows it — Available Quizzes' side panel and KPI tiles, and
 * the standalone Profile page. Both used to run their own full paginated
 * scan independently; with the bottom tab bar making the two one tap apart,
 * that meant redoing the same scan (plus a per-assignment homework lookup)
 * on every switch. This caches the result per signed-in uid instead.
 *
 * Being a root singleton, its state outlives any component and outlives
 * sign-out — the SPA never reloads, so nothing tears it down on the way to the
 * login screen. Clearing is therefore driven by an `effect` on the signed-in
 * uid rather than by the load path, matching how `TenantService`,
 * `TeacherReviewQueueService`, `QuizService` and `TranslationOverridesService`
 * each guard their own state. Clearing lazily inside `ensureLoaded()` is not
 * enough: that runs behind an `await`, while the next account's Profile and
 * Available Quizzes screens bind to these signals on their very first render.
 */
@Injectable({ providedIn: 'root' })
export class ParticipationSummaryService {
  private readonly authService = inject(AuthService);
  private readonly homeworkService = inject(HomeworkService);
  private readonly api = inject(ApiClient);

  private readonly _participationRecords = signal<ParticipationRecord[]>([]);
  private readonly _completedHomeworkIds = signal<Set<string>>(new Set());
  private readonly _needsRevisionFeedback = signal<Map<string, ParticipationValidation>>(new Map());
  private readonly _completedHomeworkCount = signal<number>(0);
  private readonly _quizStats = signal<QuizStats>({ completedCount: 0, averageScore: 0, bestScore: 0 });
  private readonly _quizRecords = signal<ParticipationRecord[]>([]);
  private readonly _assignmentKinds = signal<Map<string, AssignmentKind>>(new Map());

  readonly participationRecords: Signal<ParticipationRecord[]> = this._participationRecords;
  readonly completedHomeworkIds: Signal<Set<string>> = this._completedHomeworkIds;
  readonly needsRevisionFeedback: Signal<Map<string, ParticipationValidation>> = this._needsRevisionFeedback;
  readonly completedHomeworkCount: Signal<number> = this._completedHomeworkCount;
  readonly quizStats: Signal<QuizStats> = this._quizStats;

  /** The real kind of every assignment the student has submitted to, by homeworkId (see {@link fetch}). */
  readonly assignmentKinds: Signal<Map<string, AssignmentKind>> = this._assignmentKinds;

  /** Exactly the attempts {@link quizStats} counts, newest first — so the list and the tiles cannot disagree. */
  readonly completedQuizzes: Signal<CompletedQuizProgress[]> = computed(() =>
    [...this._quizRecords()].sort((a, b) => b.endedAt - a.endedAt).map(toCompletedQuizProgress)
  );

  private loadedForUid: string | null = null;
  /** Whose history the signals may hold: followed by the effect and by every load (see {@link syncAccount}). */
  private trackedUid: string | null = null;
  private inFlight: Promise<void> | null = null;

  /**
   * Bumped by every {@link reset}. A fetch captures it when it starts and
   * refuses to commit if it no longer matches, so a scan begun for one account
   * cannot land in the signals after a different one has signed in — the scan
   * is paginated and can easily still be running when someone signs out.
   */
  private generation = 0;

  constructor() {
    // Clears the instant the signed-in uid changes, sign-out (uid -> null)
    // included. See the class comment for why this cannot live in `load()`.
    effect(() => {
      const uid = this.authService.user()?.uid ?? null;
      untracked(() => this.syncAccount(uid));
    }, { allowSignalWrites: true });
  }

  /**
   * Clear the moment the account changes. Also called when a load starts: straight after sign-in the first screen
   * loads before the effect has run, and the effect's reset then discarded that load as the previous account's, leaving
   * the tiles at zero until the next visit.
   */
  private syncAccount(uid: string | null): void {
    if (uid === this.trackedUid) return;
    this.trackedUid = uid;
    this.reset();
  }

  /** Loads once per signed-in uid; a repeat call for the same uid is free. */
  async ensureLoaded(): Promise<void> {
    await this.load(false);
  }

  /** Forces a reload — call after an action that changes the data (a quiz was just submitted). */
  async refresh(): Promise<void> {
    await this.load(true);
  }

  private async load(force: boolean): Promise<void> {
    await this.authService.waitForAuthReady();
    const uid = this.authService.user()?.uid ?? null;
    this.syncAccount(uid);

    if (!force && uid === this.loadedForUid) return;
    if (this.inFlight) return this.inFlight;
    if (!uid) return;

    this.inFlight = this.fetch(uid)
      .finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private reset(): void {
    // Invalidates anything already in flight before clearing, so a late
    // response cannot repopulate what this just emptied.
    this.generation++;
    this.inFlight = null;
    this._participationRecords.set([]);
    this._completedHomeworkIds.set(new Set());
    this._needsRevisionFeedback.set(new Map());
    this._completedHomeworkCount.set(0);
    this._quizStats.set({ completedCount: 0, averageScore: 0, bestScore: 0 });
    this._quizRecords.set([]);
    this._assignmentKinds.set(new Map());
    this.loadedForUid = null;
  }

  /**
   * Walks every participation record the student has, across all pages, in one pass,
   * then splits it into `completedHomeworkIds`/`needsRevisionFeedback` (the
   * homework-tab filtering on Available Quizzes) and `quizStats` (the KPI
   * tiles, shown on both Available Quizzes and Profile):
   * - completed-assignment tracking needs every completed id regardless of kind
   *   (only the *latest* submission per homeworkId matters — a rejected one
   *   reopens the assignment instead of counting as done);
   * - quizStats needs attempts split into "quiz" vs "homework" *pedagogically*.
   *   `ParticipationRecord.type` can't do this alone: `onStartHomework()` always
   *   writes `type: 'homework'` for *any* teacher assignment, including ones
   *   authored with `kind: 'quiz'`. So completed assignments are re-split by
   *   their `HomeworkAssignment.kind` once fetched.
   */
  private async fetch(uid: string): Promise<void> {
    const generation = this.generation;
    const latestByHomework = new Map<string, ParticipationRecord>();
    const quizRecords: ParticipationRecord[] = [];
    const allRecords: ParticipationRecord[] = [];
    // A student is given only their own attempts, newest first.
    let page = 1;
    let total = 0;
    do {
      const result = await this.api.get<ApiPage<ApiParticipationSummary>>('/participations', { page, pageSize: 100 });
      const items = result.items.map(toParticipationRecord);
      total = result.totalCount;
      allRecords.push(...items);
      items.forEach(p => {
        if (p.type === 'quiz' && p.status === 'completed') {
          quizRecords.push(p);
          return;
        }
        if (p.type !== 'homework' || p.status !== 'completed' || !p.homeworkId) return;
        const current = latestByHomework.get(p.homeworkId);
        if (!current || p.endedAt > current.endedAt) latestByHomework.set(p.homeworkId, p);
      });
    } while (page++ * 100 < total);

    const completed = new Set<string>();
    const needsRevision = new Map<string, ParticipationValidation>();
    const completedAssignments: ParticipationRecord[] = [];
    const rejected: ParticipationRecord[] = [];
    latestByHomework.forEach(record => {
      if (record.validation?.status === 'rejected') {
        rejected.push(record);
      } else {
        completed.add(record.homeworkId!);
        completedAssignments.push(record);
      }
    });
    // A list entry carries only the verdict; the teacher's feedback is on the attempt itself.
    await Promise.all(rejected.map(async record => {
      const { participation } = await this.api.get<{ participation: ApiParticipation }>(`/participations/${record.id}`);
      needsRevision.set(record.homeworkId!, toParticipationDetail(participation).validation ?? record.validation!);
    }));
    // Every assignment the student ever submitted to, not only the counted ones: My Participations labels them all.
    const kindById = new Map<string, AssignmentKind>();
    const homeworkIds = [...new Set(allRecords.map(r => r.homeworkId).filter((id): id is string => !!id))];
    await Promise.all(homeworkIds.map(async id => {
      const assignment = await this.homeworkService.getById(id);
      kindById.set(id, assignment?.kind ?? 'homework');
    }));

    let homeworkCount = 0;
    completedAssignments.forEach(record => {
      if (kindById.get(record.homeworkId!) === 'quiz') {
        quizRecords.push(record);
      } else {
        homeworkCount++;
      }
    });

    // Somebody signed out, or a different account signed in, while the pages
    // above were still arriving. Dropping the whole result is the point: these
    // records belong to `uid`, and `reset()` has already cleared the signals
    // for whoever is here now.
    if (generation !== this.generation) return;

    // One commit, after every await. Setting the signals as each stage
    // finished meant a sign-out landing mid-scan could leave some of the
    // previous account's data behind in the ones already written.
    this._participationRecords.set(allRecords);
    this._completedHomeworkIds.set(completed);
    this._needsRevisionFeedback.set(needsRevision);
    this._completedHomeworkCount.set(homeworkCount);
    this._quizRecords.set(quizRecords);
    this._assignmentKinds.set(kindById);
    const quizPercentages = quizRecords.map(participationScorePercent);
    this._quizStats.set({
      completedCount: quizPercentages.length,
      averageScore: quizPercentages.length > 0
        ? Math.round(quizPercentages.reduce((a, b) => a + b, 0) / quizPercentages.length)
        : 0,
      bestScore: quizPercentages.length > 0 ? Math.max(...quizPercentages) : 0
    });
    this.loadedForUid = uid;
  }
}
