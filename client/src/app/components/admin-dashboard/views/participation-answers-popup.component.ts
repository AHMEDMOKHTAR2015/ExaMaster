import { Component, computed, effect, inject, input, output, signal, untracked, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { ClickOutsideDirective } from '../../../directives';
import { ParticipationRecord, ParticipationAnswer, AssignmentKind } from '../../../models';
import { participationScorePercent } from '../../../shared/participation-score';
import { maxMark } from '../../../shared/question-scoring';
import { ParticipationService } from '../../../services/admin/quizzes/participation.service';

/**
 * Standalone, presentational popup that reviews one participation attempt: a
 * summary card row plus the per-question answer breakdown stored on the record.
 *
 * The parent passes the {@link record} (and the student's name for the summary)
 * and listens for {@link closed}. Lists carry no answers, so when the record
 * came from one the popup reads the attempt whole itself — every view that
 * holds a participation record can open it without knowing that.
 */
@Component({
    selector: 'app-participation-answers-popup',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, TranslatePipe, ClickOutsideDirective],
    templateUrl: './participation-answers-popup.component.html'
})
export class ParticipationAnswersPopupComponent {
  /** The attempt being reviewed. Required — the parent only renders when set. */
  readonly record = input.required<ParticipationRecord>();

  /** Optional student name shown in the summary "Student" card. */
  readonly studentName = input<string | null>(null);

  /**
   * The real Quiz-vs-Homework kind of the assignment this attempt answers,
   * for the "Quiz answers" / "Homework answers" header — every caller can
   * derive this cheaply from data it already has (its own assignment list,
   * or the `ValidationItem` the attempt came from), so it is required in
   * practice even though the type stays optional for a caller with truly
   * nothing to go on.
   *
   * Deliberately not derived from `record().type` in here: that field only
   * says whether the attempt went through an assignment at all
   * (`payload.homeworkId ? 'homework' : 'quiz'` in `submit-quiz.ts`), not
   * what kind of content the assignment actually is — a Quiz-kind assignment
   * taken via "Start" still sets `homeworkId`, so `type` reads `'homework'`
   * for it regardless. This component owns no data fetching (see the class
   * doc), so it cannot resolve the real kind itself; it can only display
   * whatever the caller already knows.
   */
  readonly kind = input<AssignmentKind | null>(null);

  /** The student is reviewing their own attempt: answers read as "Your answer". */
  readonly ownAttempt = input(false);

  private readonly participations = inject(ParticipationService);

  /** The attempt read whole, when {@link record} came from a list and has no answers. */
  private readonly full = signal<ParticipationRecord | null>(null);
  readonly isLoadingAnswers = signal(false);

  constructor() {
    effect(() => {
      const record = this.record();
      untracked(() => void this.loadAnswers(record));
    }, { allowSignalWrites: true });
  }

  private async loadAnswers(record: ParticipationRecord): Promise<void> {
    this.full.set(null);
    if (record.metadata?.answers) return;
    this.isLoadingAnswers.set(true);
    try {
      const full = await this.participations.getById(record.id);
      if (this.record() === record) this.full.set(full);
    } catch {
      // The summary still shows; only the breakdown is missing.
    } finally {
      this.isLoadingAnswers.set(false);
    }
  }

  /**
   * Emitted when the user dismisses the popup (overlay, ✕, or Close).
   *
   * Named `closed`, not `close`: an output sharing a native DOM event name is
   * bound by the same syntax the browser event uses, so a real `close` event
   * bubbling from within would also fire the handler.
   */
  readonly closed = output<void>();

  /** The attempt as read whole, falling back to the list record until it arrives. */
  private readonly shown = computed(() => this.full() ?? this.record());

  /** False while an assignment's correct answers are withheld from the student (see the model field). */
  readonly resultsWithheld = computed(() => this.shown().resultsAvailable === false);

  /** The teacher's overall comment on the submission, if they left one. */
  readonly feedback = computed(() => this.shown().validation?.feedback ?? null);

  /** Per-question breakdown persisted on the record, if any. */
  readonly answers = computed<ParticipationAnswer[]>(() => {
    const raw = this.shown().metadata?.answers;
    return Array.isArray(raw) ? raw : [];
  });

  /**
   * The attempt's weighted score, as a real 0–100 percentage.
   *
   * This used to fall back to the raw `score` field when `scorePercent` was
   * absent, but `score` is a correct-answer *count* — so an older record for a
   * 7-of-10 attempt rendered as "7%", and the summary card's pass/fail icon
   * colour (thresholded at 50) was decided on that count too. The shared helper
   * derives the ratio for those records instead.
   */
  readonly scoreLabel = computed(() => participationScorePercent(this.record()));

  /** Explain answers still waiting on a teacher's mark. */
  readonly pendingReviewCount = computed(() =>
    this.record().pendingReviewCount ?? this.answers().filter(a => a.requiresReview && !a.manualGrade).length
  );

  /** "Your answer" on a student's own attempt, "Student answered" for everyone else. */
  get answeredLabel(): string {
    return this.ownAttempt() ? 'participationAnswers.yourAnswer' : 'participationAnswers.studentAnswered';
  }

  /** The points a reviewed answer was marked out of (see `maxMark`). */
  weightLabel(answer: ParticipationAnswer): number {
    return maxMark(answer.weightPercent ?? 0);
  }

  /** The points a teacher awarded. */
  awardedLabel(answer: ParticipationAnswer): number {
    return Math.round(answer.manualGrade?.awardedPercent ?? 0);
  }
}
