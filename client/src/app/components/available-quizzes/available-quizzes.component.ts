import { Component, OnInit, OnDestroy, signal, computed, effect, untracked, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../services/auth';
import { QuizService } from '../../services/quiz.service';
import { QuizRunnerService } from '../../services/quiz-runner.service';
import { UserProfileService } from '../../services/user-profile.service';
import { HomeworkService } from '../../services/homework.service';
import { NotificationService } from '../../services/notification.service';
import { ParticipationSummaryService } from '../../services/participation-summary.service';
import {
  StageService,
  GradeService,
  TeacherService,
  SubjectService,
  ClassGroupService
} from '../../services/admin';
import { HomeworkAssignment, Question, Teacher, Subject, ClassGroup, QuizAttemptLock, QUESTION_TYPE } from '../../models';
import { QuizLockService, isBlocking } from '../../services/quiz/quiz-lock.service';
import { QuizLockdownService } from '../../services/quiz/quiz-lockdown.service';
import { QuizAttemptScope, attemptScopeKey } from '../../shared/quiz-attempt-scope';
import { BaseComponent } from '../../shared/base';
import { UserProfileComponent } from '../user-profile/user-profile.component';
import { QuizListComponent } from '../quiz-list/quiz-list.component';
import { AssignmentThumbnailComponent } from './assignment-thumbnail.component';
import { SubjectPerformanceComponent } from './subject-performance.component';
import { QuestionOptionsComponent } from '../../question-options/question-options.component';
import { QuestionCompleteComponent } from '../../question-complete/question-complete.component';
import { QuestionExplainComponent } from '../../question-explain/question-explain.component';
import { QuizResultComponent } from '../../quiz-result/quiz-result.component';
import { fadeIn, slideInLeft, slideInRight, questionPageSwap } from '../../shared/animations';
import { questionIllustration, QUIZ_IN_PROGRESS_ILLUSTRATION } from '../../shared/question-illustration';
import { filterAvailableQuizzesForUser, isOverdue } from '../../shared/quiz-filters';
import { resolveSubjectTeaching, SubjectTeaching } from '../../shared/teaching';
import { indexQuizzesById, effectiveSubjectId } from '../../shared/quiz-management';

/**
 * A start the student has asked for but that has not opened yet — either
 * because its entry check is still running, or because it is a One Time Join
 * quiz waiting on the confirmation dialog.
 */
interface PendingStart {
  kind: 'quiz' | 'homework';
  title: string;
  quizId: number;
  /** How the attempt is addressed for locking; see `shared/quiz-attempt-scope.ts`. */
  scope: QuizAttemptScope;
  oneTimeJoin: boolean;
  /** Present only for an assignment-driven start. */
  assignment?: HomeworkAssignment;
}

@Component({
    selector: 'app-available-quizzes',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        RouterModule,
        TranslatePipe,
        UserProfileComponent,
        QuizListComponent,
        AssignmentThumbnailComponent,
        SubjectPerformanceComponent,
        QuestionOptionsComponent,
        QuestionCompleteComponent,
        QuestionExplainComponent,
        QuizResultComponent
    ],
    templateUrl: './available-quizzes.component.html',
    animations: [fadeIn, slideInLeft, slideInRight, questionPageSwap]
})
export class AvailableQuizzesComponent extends BaseComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  readonly quizService = inject(QuizService);
  readonly runner = inject(QuizRunnerService);
  private readonly userProfileService = inject(UserProfileService);
  private readonly participationSummary = inject(ParticipationSummaryService);
  private readonly homeworkService = inject(HomeworkService);
  private readonly notificationService = inject(NotificationService);
  private readonly stageService = inject(StageService);
  private readonly gradeService = inject(GradeService);
  private readonly teacherService = inject(TeacherService);
  private readonly subjectService = inject(SubjectService);
  private readonly classService = inject(ClassGroupService);
  private readonly quizLockService = inject(QuizLockService);
  readonly lockdown = inject(QuizLockdownService);
  private readonly router = inject(Router);

  constructor() {
    super();
    // A One Time Join attempt the student walked out of is over. The runner
    // reports the exit; closing the quiz is this component's job, because it
    // owns `activeQuizId` — the runner has no idea a quiz page exists.
    effect(() => {
      const breach = this.runner.containmentBreach();
      if (!breach) return;
      untracked(() => void this.endBreachedAttempt(breach.lock));
    }, { allowSignalWrites: true });
  }

  /** Exposed for the template to branch question rendering on type. */
  readonly QUESTION_TYPE = QUESTION_TYPE;

  readonly user = this.authService.user;
  readonly userProfile = this.userProfileService.profile;
  readonly isChild = computed(() => this.user()?.accountType === 'child');

  readonly stageName = signal<string | null>(null);
  readonly gradeName = signal<string | null>(null);

  readonly activeTab = signal<'quizzes' | 'homework' | 'teachers'>('quizzes');

  // My Subjects & Teachers (child view)
  readonly teachers = signal<Teacher[]>([]);
  readonly subjects = signal<Subject[]>([]);
  readonly myClass = signal<ClassGroup | null>(null);
  readonly className = computed(() => this.myClass()?.name ?? null);
  readonly myTeaching = computed<SubjectTeaching[]>(() =>
    resolveSubjectTeaching(this.myClass(), this.teachers())
  );

  /**
   * Subject id → name and colour, handed to the quiz list for its cards' tags.
   *
   * Built here because this component already loads the subjects; the list and
   * the card stay pure projections rather than fetching reference data of their
   * own, one request per card.
   */
  readonly subjectLookup = computed(() =>
    new Map(this.subjects().map(s => [s.id, { name: s.name, color: s.color }] as const))
  );

  readonly isLoadingQuizzes = signal<boolean>(false);
  readonly isLoadingHomework = signal<boolean>(true);

  readonly allQuizzes = computed(() => this.quizService.quizList());
  readonly quizById = computed(() => indexQuizzesById(this.allQuizzes()));
  /** Bank quizzes this student has already submitted (the API marks them). */
  readonly completedQuizIds = computed(() => this.allQuizzes().filter(quiz => quiz.completedByMe).map(quiz => quiz.id));

  readonly activeQuizId = signal<number | null>(null);
  readonly showQuiz = computed(() => this.activeQuizId() !== null);

  /**
   * The quiz header's picture: the type of the question on screen while the
   * student answers (the page's first, when a page shows several), the generic
   * quiz picture while it loads and on the review and result screens. Read as a
   * one-item list by the template, so a change of picture cross-fades.
   */
  readonly headerIllustration = computed(() => {
    if (!this.showQuiz() || this.runner.mode() !== 'quiz') return QUIZ_IN_PROGRESS_ILLUSTRATION;
    return questionIllustration(this.runner.currentPageQuestions()[0]?.questionTypeId);
  });

  readonly availableQuizzes = computed(() =>
    filterAvailableQuizzesForUser(this.allQuizzes(), this.completedQuizIds(), this.user())
  );

  /**
   * This student's submissions and derived quiz stats — shared with the
   * standalone Profile page via ParticipationSummaryService rather than
   * loaded independently here, so switching between the two tabs doesn't
   * re-run the same paginated scan every time.
   */
  readonly participationRecords = this.participationSummary.participationRecords;
  readonly completedQuizzes = this.participationSummary.completedQuizzes;

  readonly showMobileProfile = signal<boolean>(false);

  // ---------------------------------------------------------------
  // "One Time Join" containment
  // ---------------------------------------------------------------

  /**
   * Every containment lock this student holds, keyed by scope key. Read once
   * with the quiz list so each card can show its own state without a document
   * read per card; re-read after a run finishes, since submitting released one.
   */
  readonly attemptLocks = signal<Map<string, QuizAttemptLock>>(new Map());

  /**
   * The quiz waiting on the student's confirmation, or `null`.
   *
   * A One Time Join quiz does not load until this is confirmed — deliberately,
   * so the warning is the last thing between the student and a sitting they
   * cannot walk out of, and so no lock is written for a quiz they backed out of.
   */
  readonly pendingStart = signal<PendingStart | null>(null);

  /** True while the entry check for a start the student just clicked is in flight. */
  readonly isCheckingEntry = signal<boolean>(false);

  /** The blocking lock the student just ran into, shown in its own dialog. */
  readonly blockedByLock = signal<QuizAttemptLock | null>(null);

  /** Locked bank-quiz ids, so a card can be marked without a lookup per render. */
  readonly lockedQuizIds = computed(() => {
    const ids = new Set<number>();
    this.attemptLocks().forEach(lock => {
      if (!isBlocking(lock) || lock.homeworkId) return;
      if (lock.scopeKey.startsWith('bank:')) ids.add(Number(lock.scopeKey.slice('bank:'.length)));
    });
    return ids;
  });

  readonly homeworkAssignments = signal<HomeworkAssignment[]>([]);

  /** Ids of homework the student has already submitted — kept out of the to-do list below. */
  readonly completedHomeworkIds = this.participationSummary.completedHomeworkIds;

  /** Ids of homework whose latest submission was sent back for revision, keyed to the teacher's verdict — these reopen in the to-do list. */
  readonly needsRevisionFeedback = this.participationSummary.needsRevisionFeedback;

  /**
   * Count of completed assignments whose `kind` is `'homework'` (not `'quiz'`) —
   * drives the child dashboard's "Completed Homework" stat.
   */
  readonly completedHomeworkCount = this.participationSummary.completedHomeworkCount;

  /**
   * Quiz attempt stats — standalone bank quizzes *and* completed assignments whose
   * `kind` is `'quiz'` (assignments start via the same `onStartHomework()` writer
   * as real homework, so `ParticipationRecord.type` alone can't tell them apart).
   * Drives the child dashboard's quiz KPI tiles.
   */
  readonly quizStats = this.participationSummary.quizStats;

  readonly pendingHomeworkAssignments = computed(() => {
    const completed = this.completedHomeworkIds();
    return this.homeworkAssignments().filter(hw => !completed.has(hw.id));
  });

  /** Assignments authored as a "quiz" — surfaced under the Quizzes tab, not Homework. */
  readonly pendingQuizAssignments = computed(() =>
    this.pendingHomeworkAssignments().filter(hw => hw.kind === 'quiz')
  );

  /** Legacy records without `kind` default to homework. */
  readonly pendingHomeworkOnlyAssignments = computed(() =>
    this.pendingHomeworkAssignments().filter(hw => hw.kind !== 'quiz')
  );

  ngOnInit(): void {
    void this.participationSummary.ensureLoaded();
    this.loadStageName();
    void this.loadGradeName();
    this.loadMyTeaching();
    // Sequenced, not fired alongside the others: whether the lock lookup is
    // needed at all is a question about what these two lists contain.
    void this.loadWorkAndLocks();
  }

  /** The quiz/homework lists, then the containment lookup they decide the need for. */
  private async loadWorkAndLocks(): Promise<void> {
    await Promise.all([this.loadQuizzes(), this.loadHomework()]);
    await this.loadAttemptLocks();
  }

  ngOnDestroy(): void {
    // Leaving the page mid-attempt IS leaving the quiz. The router is the one
    // exit `beforeunload` and the history sentinel cannot see, so it is
    // reported here before `reset()` tears the guards down — otherwise an
    // in-app navigation would be the one way out that costs nothing.
    if (this.runner.isContained()) this.lockdown.reportExit('navigated');
    this.runner.reset();
  }

  private async loadStageName(): Promise<void> {
    await this.authService.waitForAuthReady();
    const user = this.user();
    if (!user?.stageId) {
      this.stageName.set(null);
      return;
    }
    const stage = await this.stageService.fetchStage(user.stageId);
    this.stageName.set(stage?.name ?? user.stageId);
  }

  /**
   * The student's grade, for the profile card's second chip row.
   *
   * Separate from {@link loadStageName} rather than folded into it: a student
   * can sit in a stage with no grade recorded yet, and one missing name must
   * not withhold the other. Falls back to nothing rather than to the raw id —
   * an unresolvable grade is better shown as absent than as `grade-7v2`.
   */
  private async loadGradeName(): Promise<void> {
    await this.authService.waitForAuthReady();
    const user = this.user();
    if (!user?.gradeId) {
      this.gradeName.set(null);
      return;
    }
    const grade = await this.gradeService.fetchGrade(user.gradeId);
    this.gradeName.set(grade?.name ?? null);
  }

  private async loadMyTeaching(): Promise<void> {
    await this.authService.waitForAuthReady();
    const user = this.user();
    if (user?.accountType !== 'child' || !user.classId) {
      this.myClass.set(null);
      return;
    }

    const [teachers, subjects, cls] = await Promise.all([
      this.loadAllTeachers(),
      this.loadAllSubjects(),
      this.classService.fetchClass(user.classId)
    ]);
    this.teachers.set(teachers);
    this.subjects.set(subjects);
    this.myClass.set(cls);
  }

  private async loadAllTeachers(): Promise<Teacher[]> {
    let cursor: string | undefined;
    const items: Teacher[] = [];
    do {
      const result = await this.teacherService.listTeachers(50, cursor);
      items.push(...result.items);
      cursor = result.nextCursor;
    } while (cursor);
    return items;
  }

  private async loadAllSubjects(): Promise<Subject[]> {
    let cursor: string | undefined;
    const items: Subject[] = [];
    do {
      const result = await this.subjectService.listSubjects(50, cursor);
      items.push(...result.items);
      cursor = result.nextCursor;
    } while (cursor);
    return items;
  }

  getSubjectName(subjectId: string): string {
    return this.subjects().find(s => s.id === subjectId)?.name ?? '';
  }

  getSubjectColor(subjectId: string): string | undefined {
    return this.subjects().find(s => s.id === subjectId)?.color;
  }

  getTeacherName(teacherId: string): string {
    const t = this.teachers().find(t => t.id === teacherId);
    return t ? `${t.firstName} ${t.lastName}`.trim() : teacherId;
  }

  getTeacherInitials(teacherId: string): string {
    const t = this.teachers().find(t => t.id === teacherId);
    if (!t) return '?';
    return ((t.firstName?.[0] ?? '') + (t.lastName?.[0] ?? '')).toUpperCase() || '?';
  }

  private async loadQuizzes(): Promise<void> {
    this.isLoadingQuizzes.set(true);
    this.setLoading(true);
    try {
      await this.quizService.loadAll();
    } catch {
      this.notificationService.error('Failed to load quizzes. Please try again.');
      this.setError('Failed to load quizzes. Please try again.');
    } finally {
      this.isLoadingQuizzes.set(false);
      this.setLoading(false);
    }
  }

  /**
   * "Start Quiz" on a bank quiz card.
   *
   * Every start funnels through {@link requestStart}: an ordinary quiz reaches
   * `beginStart` unchanged, and a One Time Join one is checked and confirmed
   * first.
   */
  onStartQuiz(quizId: number): Promise<void> {
    const quiz = this.quizById().get(quizId);
    return this.requestStart({
      kind: 'quiz',
      title: quiz?.name ?? '',
      quizId,
      scope: { source: 'bank', quizId },
      oneTimeJoin: !!quiz?.config?.oneTimeJoin
    });
  }

  /** "Start" on an assignment card — homework or an assigned quiz. */
  onStartHomework(assignment: HomeworkAssignment): Promise<void> {
    return this.requestStart({
      kind: 'homework',
      title: assignment.title,
      quizId: assignment.quizId,
      assignment,
      scope: assignmentScope(assignment),
      oneTimeJoin: !!assignment.oneTimeJoin
    });
  }

  /**
   * The gate every start passes through.
   *
   * Two things happen here that cannot happen later: the lock is re-read from
   * the server (the cached map is as old as the last list load, and a teacher
   * may have unlocked or a sibling tab may have opened the attempt), and a One
   * Time Join quiz is held back for confirmation. Neither is a security
   * boundary — that is `POST /attempt-locks`, which refuses a second sitting —
   * but a student who is locked out should be told so, not shown a quiz that
   * fails to record.
   */
  private async requestStart(request: PendingStart): Promise<void> {
    // Only a contained quiz pays for the entry read. An ordinary quiz has no
    // lock to find, and this is the hot path every student takes on every
    // start — including one whose quiz WAS contained until a teacher turned the
    // setting off, which correctly lets them straight back in.
    if (request.oneTimeJoin) {
      this.isCheckingEntry.set(true);
      try {
        const blocking = await this.runner.findBlockingLock(request.scope);
        if (blocking) {
          this.cacheLock(blocking);
          this.blockedByLock.set(blocking);
          return;
        }
      } finally {
        this.isCheckingEntry.set(false);
      }
    }

    if (request.oneTimeJoin) {
      this.pendingStart.set(request);
      return;
    }
    await this.beginStart(request);
  }

  /** The student accepted the One Time Join terms. */
  async confirmPendingStart(): Promise<void> {
    const request = this.pendingStart();
    if (!request) return;
    // First statement in the handler, and deliberately not awaited: the
    // Fullscreen API only honours a request made directly from the click that
    // provoked it, so anything placed above this — or an `await` before it —
    // gets the request refused.
    void this.lockdown.requestFullscreen();
    this.pendingStart.set(null);
    await this.beginStart(request);
  }

  /** Backed out of the warning: nothing was loaded and no lock was written. */
  cancelPendingStart(): void {
    this.pendingStart.set(null);
  }

  dismissBlocked(): void {
    this.blockedByLock.set(null);
  }

  /** Actually open the quiz. An assignment is sat through the assignment: the server decides its quiz. */
  private async beginStart(request: PendingStart): Promise<void> {
    this.activeQuizId.set(request.quizId);
    const assignment = request.assignment;
    if (!assignment) {
      await this.runner.start(request.quizId);
      return;
    }
    if (assignment.quizSource === 'custom' && assignment.customQuizId) {
      await this.runner.startCustom(assignment.customQuizId, { homeworkId: assignment.id });
    } else {
      await this.runner.start(assignment.quizId, { homeworkId: assignment.id });
    }
  }

  private cacheLock(lock: QuizAttemptLock): void {
    this.attemptLocks.update(map => new Map(map).set(lock.scopeKey, lock));
  }

  /** Whether this assignment is one the student may not re-open. */
  isAssignmentLocked(assignment: HomeworkAssignment): boolean {
    return isBlocking(this.attemptLocks().get(attemptScopeKey(assignmentScope(assignment))));
  }

  /**
   * The student's own locks, read alongside the quiz list.
   *
   * Failures are swallowed to a warning rather than an error banner: a locked
   * quiz still refuses to open at the point of entry (and, ultimately, on the
   * server), so a missing badge is cosmetic.
   */
  private async loadAttemptLocks(): Promise<void> {
    await this.authService.waitForAuthReady();
    if (!this.user()) return;

    // Nothing on this dashboard can be locked, so there is nothing to look up.
    // Most students in most schools never meet a One Time Join quiz, and this
    // runs on every dashboard load — the same reasoning that keeps the
    // pre-entry check in `requestStart` off the ordinary start path.
    if (!this.hasContainedWork()) {
      this.attemptLocks.set(new Map());
      return;
    }

    try {
      const locks = await this.quizLockService.listMine();
      this.attemptLocks.set(new Map(locks.map(lock => [lock.scopeKey, lock])));
    } catch {
      this.attemptLocks.set(new Map());
    }
  }

  /**
   * Whether any quiz or assignment currently on screen is a One Time Join one.
   *
   * Reads what the lists already hold — a bank quiz's config, an assignment's
   * `oneTimeJoin` — so it costs no extra request.
   */
  private hasContainedWork(): boolean {
    return this.availableQuizzes().some(quiz => quiz.config?.oneTimeJoin)
      || this.pendingHomeworkAssignments().some(a => a.oneTimeJoin);
  }

  /**
   * Close a contained attempt the student left, and tell them why.
   *
   * Reuses the ordinary return-to-list path rather than a shortcut, so the
   * quiz list is refreshed the same way it is after a submission — which is
   * what repaints the card with its "Locked" badge. The dialog is set after,
   * because `onBackToQuizList` reloads the locks and would otherwise race the
   * record we are about to show.
   */
  private async endBreachedAttempt(lock: QuizAttemptLock | null): Promise<void> {
    if (!this.showQuiz()) return;
    await this.onBackToQuizList();
    if (lock) this.blockedByLock.set(lock);
  }

  async onBackToQuizList(): Promise<void> {
    this.runner.reset();
    this.activeQuizId.set(null);
    await this.authService.refreshUserData();
    void this.participationSummary.refresh();
    // The locks follow the lists because a submitted attempt had its own
    // released server-side, and re-reading is what clears the card's "Locked"
    // badge without a reload.
    await Promise.all([this.quizService.refresh().catch(() => undefined), this.loadHomework()]);
    await this.loadAttemptLocks();
  }

  onAnswerSelected(_question: Question): void {
    this.runner.onAnswerSelected();
  }

  /**
   * The assignments set for this student. The server does the choosing —
   * active ones only, and a targeted assignment only for the students it names
   * — and returns them whole.
   */
  private async loadHomework(): Promise<void> {
    await this.authService.waitForAuthReady();
    if (this.user()?.accountType !== 'child') {
      this.isLoadingHomework.set(false);
      return;
    }

    this.isLoadingHomework.set(true);
    try {
      this.homeworkAssignments.set(await this.homeworkService.listForMe());
    } catch {
      this.notificationService.error('Failed to load your assignments. Please try again.');
    } finally {
      this.isLoadingHomework.set(false);
    }
  }

  setActiveTab(tab: 'quizzes' | 'homework' | 'teachers'): void {
    this.activeTab.set(tab);
  }

  isOverdue(dueAt: number): boolean {
    return isOverdue(dueAt);
  }

  /** Effective subject id for an assignment — its own value, else (for a bank quiz) its quiz's. */
  private resolveAssignmentSubjectId(assignment: HomeworkAssignment): string | undefined {
    return assignment.quizSource === 'custom'
      ? assignment.subjectId
      : effectiveSubjectId(assignment, this.quizById());
  }

  /**
   * Who assigned this quiz, for the card's "assigned by" line.
   *
   * A student may not read the creator's user record, so the name is the one
   * the server puts on the assignment (`createdByName`). Without it, fall back to
   * the teacher who educates the assignment's subject in this child's class —
   * and only when exactly one teacher does, since with two the assigner is a
   * guess and a wrong name is worse than none.
   */
  assignmentTeacherName(assignment: HomeworkAssignment): string {
    const denormalized = assignment.createdByName?.trim();
    if (denormalized) return denormalized;

    const subjectId = this.resolveAssignmentSubjectId(assignment);
    if (!subjectId) return '';
    const teacherIds = this.myTeaching().find(row => row.subjectId === subjectId)?.teacherIds ?? [];
    return teacherIds.length === 1 ? this.getTeacherName(teacherIds[0]) : '';
  }

  /** Initials for the assigner's avatar; empty when {@link assignmentTeacherName} is. */
  assignmentTeacherInitials(assignment: HomeworkAssignment): string {
    const parts = this.assignmentTeacherName(assignment).split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  assignmentSubjectName(assignment: HomeworkAssignment): string {
    const subjectId = this.resolveAssignmentSubjectId(assignment);
    return subjectId ? this.getSubjectName(subjectId) : '';
  }

  assignmentSubjectColor(assignment: HomeworkAssignment): string | undefined {
    const subjectId = this.resolveAssignmentSubjectId(assignment);
    return subjectId ? this.getSubjectColor(subjectId) : undefined;
  }

  /** How many questions the assignment's quiz has — the one it is sat and graded on. */
  assignmentQuestionCount(assignment: HomeworkAssignment): number {
    return assignment.questionCount ?? 0;
  }

  /** Duration in minutes for an assignment's linked quiz; 0 means unlimited. */
  assignmentDurationMinutes(assignment: HomeworkAssignment): number {
    const durationSeconds = assignment.quizDurationSeconds;
    return durationSeconds ? Math.round(durationSeconds / 60) : 0;
  }

  async onSignOut(): Promise<void> {
    try {
      await this.authService.signOut();
      this.router.navigate(['/login']);
    } catch {
      this.notificationService.error('Failed to sign out. Please try again.');
    }
  }

  toggleMobileProfile(): void {
    this.showMobileProfile.update(v => !v);
  }
}

/** How an assignment's attempt is addressed for locking: by the assignment. */
function assignmentScope(assignment: HomeworkAssignment): QuizAttemptScope {
  const custom = assignment.quizSource === 'custom';
  return {
    source: custom ? 'teacher' : 'bank',
    quizId: assignment.quizId,
    teacherQuizId: custom ? assignment.customQuizId ?? null : null,
    homeworkId: assignment.id
  };
}
