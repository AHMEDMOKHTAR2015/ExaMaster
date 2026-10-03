import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { LoadingButtonDirective } from '../../../directives';
import { HomeworkParticipationService, ParticipationService } from '../../../services/admin';
import { ReviewQueueItem, ReviewVerdictFilter } from '../../../services/admin/quizzes/homework-participation.service';
import { LoadMoreList } from '../../../shared/load-more-list';
import { NotificationService } from '../../../services/notification.service';
import { TeacherReviewQueueService } from '../../../services/teacher-review-queue.service';
import { ParticipationAnswer, ParticipationRecord, AssignmentKind } from '../../../models';
import { suggestedCompleteAward } from '../../../shared/grade-quiz';
import { maxMark } from '../../../shared/question-scoring';
import { ParticipationAnswersPopupComponent } from '../../admin-dashboard/views/participation-answers-popup.component';
import { QuizManagementStateService, ValidationItem } from '../quiz-management-state.service';

/** In-progress mark for one reviewed answer while the validation popup is open. */
interface ReviewGradeDraft {
  awardedPercent: number;
  comment: string;
}

/**
 * "Validation" tab — the teacher's review queue for completed submissions.
 *
 * Owns both popups it opens (the read-only answer review and the validation
 * editor) because nothing outside this tab opens either one.
 */
@Component({
    selector: 'app-validation-tab',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule, TranslatePipe, ParticipationAnswersPopupComponent, LoadingButtonDirective],
    templateUrl: './validation-tab.component.html'
})
export class ValidationTabComponent {
  readonly state = inject(QuizManagementStateService);
  private readonly homeworkParticipationService = inject(HomeworkParticipationService);
  private readonly participations = inject(ParticipationService);
  private readonly notification = inject(NotificationService);
  private readonly reviewQueue = inject(TeacherReviewQueueService);

  readonly validationFilter = signal<ReviewVerdictFilter>('pending');

  /**
   * The review queue, a page at a time: every submission this teacher reviews
   * (their assignments' and bank quizzes naming them), narrowed by the verdict
   * select and the filter bar — by the API, which also orders it.
   */
  readonly queue = new LoadMoreList<ReviewQueueItem>(
    () => {
      const reviewerId = this.state.currentUser()?.id;
      return reviewerId
        ? this.homeworkParticipationService.reviewQueueSource(reviewerId, this.validationFilter(), this.state.appliedFilter())
        : null;
    },
    20,
    () => this.notification.error('Failed to load the submissions to review.')
  );

  // ---- Answer-review popup (reused presentational component) ------------------
  readonly answersRecord = signal<ParticipationRecord | null>(null);
  readonly answersStudentName = signal<string | null>(null);
  /** The opened attempt's real Quiz-vs-Homework kind — see the popup's own `kind` input doc for why `record.type` can't answer this. */
  readonly answersKind = signal<AssignmentKind | null>(null);

  // ---- Validation editor popup ----------------------------------------------
  readonly validationTarget = signal<ValidationItem | null>(null);
  readonly validationStatus = signal<'approved' | 'rejected'>('approved');
  readonly validationFeedback = signal('');
  readonly isSavingValidation = signal(false);

  /**
   * Draft marks for the answers awaiting review in the submission currently open
   * in the validation popup, keyed by questionId. Held separately from the record
   * so an abandoned popup leaves nothing behind.
   */
  readonly reviewDrafts = signal<Map<number, ReviewGradeDraft>>(new Map());

  constructor() {
    // Re-ask the API whenever the verdict select, the filter bar or the shell's Refresh changes what is in view.
    effect(() => {
      this.validationFilter(); this.state.appliedFilter(); this.state.refreshTick(); this.state.currentUser();
      untracked(() => void this.queue.reload());
    });
  }

  /**
   * The answers in the open submission that a human has to mark, in question
   * order — Explain and Complete alike.
   *
   * Keyed off the persisted `requiresReview` flag rather than the question type,
   * so a record graded under an older rule keeps behaving the way it was graded:
   * a Complete answer submitted before review applied to it stays auto-scored
   * and does not reappear in the teacher's queue.
   */
  readonly reviewAnswers = computed<ParticipationAnswer[]>(() => {
    const answers = this.validationTarget()?.record.metadata?.answers;
    return Array.isArray(answers) ? answers.filter(a => a.requiresReview) : [];
  });

  /** The queue's rows, each with the assignment it answers when that assignment is in view (for its group's name). */
  readonly filteredValidationItems = computed<ValidationItem[]>(() => {
    const assignmentsById = new Map(this.state.assignments().map(a => [a.id, a]));
    return this.queue.items().map(({ record, studentName, kind }) => {
      const assignment = record.homeworkId ? assignmentsById.get(record.homeworkId) ?? null : null;
      return {
        assignment,
        record,
        studentName,
        title: assignment?.title ?? record.homeworkTitle ?? record.quizName ?? '',
        kind
      };
    });
  });

  // ---- Answer review ---------------------------------------------------------

  openAnswers(record: ParticipationRecord, studentName: string | null, kind: AssignmentKind): void {
    this.answersRecord.set(record);
    this.answersStudentName.set(studentName);
    this.answersKind.set(kind);
  }

  closeAnswers(): void {
    this.answersRecord.set(null);
    this.answersKind.set(null);
    this.answersStudentName.set(null);
  }

  // ---- Validation ------------------------------------------------------------

  /** Lists carry no answers, so the attempt is read whole before its marks can be edited. */
  async openValidation(listed: ValidationItem): Promise<void> {
    let item = listed;
    if (!listed.record.metadata?.answers) {
      const full = await this.participations.getById(listed.record.id).catch(() => null);
      if (!full) {
        this.notification.error('Could not open this submission. Please try again.');
        return;
      }
      item = { ...listed, record: full };
    }
    this.validationTarget.set(item);
    this.validationStatus.set(item.record.validation?.status ?? 'approved');
    this.validationFeedback.set(item.record.validation?.feedback ?? '');

    // Seed each draft from any mark already recorded, so re-opening a reviewed
    // submission shows what the teacher gave last time.
    //
    // Ungraded Complete answers open at the exact-match suggestion instead of 0.
    // Most blanks are answered exactly as authored, so this makes the common
    // case a confirmation rather than data entry, and leaves the teacher to
    // spend their attention on the handful that actually need judgement. Explain
    // has nothing to suggest and still opens at 0.
    const answers = item.record.metadata?.answers;
    const drafts = new Map<number, ReviewGradeDraft>();
    if (Array.isArray(answers)) {
      for (const answer of answers) {
        if (!answer.requiresReview) continue;
        drafts.set(answer.questionId, {
          awardedPercent: answer.manualGrade?.awardedPercent ?? suggestedCompleteAward(answer),
          comment: answer.manualGrade?.comment ?? ''
        });
      }
    }
    this.reviewDrafts.set(drafts);
  }

  closeValidation(): void {
    this.validationTarget.set(null);
    this.reviewDrafts.set(new Map());
  }

  /** The most points for one reviewed answer: its share of the quiz rounded (see `maxMark`). */
  maxAwardFor(answer: ParticipationAnswer): number {
    return maxMark(answer.weightPercent ?? 0);
  }

  awardFor(answer: ParticipationAnswer): number {
    return this.reviewDrafts().get(answer.questionId)?.awardedPercent ?? 0;
  }

  commentFor(answer: ParticipationAnswer): string {
    return this.reviewDrafts().get(answer.questionId)?.comment ?? '';
  }

  setAward(answer: ParticipationAnswer, value: number | string): void {
    const max = this.maxAwardFor(answer);
    const parsed = Number(value);
    const clamped = Math.min(max, Math.max(0, Number.isFinite(parsed) ? parsed : 0));
    this.updateDraft(answer.questionId, draft => ({ ...draft, awardedPercent: clamped }));
  }

  setAwardComment(answer: ParticipationAnswer, comment: string): void {
    this.updateDraft(answer.questionId, draft => ({ ...draft, comment }));
  }

  private updateDraft(questionId: number, patch: (draft: ReviewGradeDraft) => ReviewGradeDraft): void {
    this.reviewDrafts.update(map => {
      const next = new Map(map);
      next.set(questionId, patch(next.get(questionId) ?? { awardedPercent: 0, comment: '' }));
      return next;
    });
  }

  async saveValidation(): Promise<void> {
    const item = this.validationTarget();
    if (!item) return;

    const feedback = this.validationFeedback().trim();
    // A reviewed answer carries a share of the quiz score that only a human can
    // award, so the marks go in the same request as the verdict — a teacher
    // cannot approve a submission and leave it unscored. The server recomputes
    // the score and tells the student.
    const marks = this.reviewAnswers().map(answer => {
      const draft = this.reviewDrafts().get(answer.questionId);
      const comment = draft?.comment.trim();
      return {
        questionId: answer.questionId,
        awardedPercent: Math.min(this.maxAwardFor(answer), Math.max(0, draft?.awardedPercent ?? 0)),
        comment: comment || null
      };
    });

    this.isSavingValidation.set(true);
    try {
      const saved = await this.homeworkParticipationService.review(item.record.id, { status: this.validationStatus(), feedback }, marks);
      // The queue and its badge re-ask the API (a verdict moves the row from Pending to Reviewed); the
      // Participation tab's cache takes the new score in place.
      if (saved) this.state.patchRecord(item.record.homeworkId ?? null, item.record.id, saved);
      void this.queue.reload();
      void this.state.refreshPendingValidationCount();
      void this.reviewQueue.refresh();
      this.notification.success(`Submission ${this.validationStatus() === 'approved' ? 'approved' : 'marked for revision'}.`);
      this.validationTarget.set(null);
    } catch {
      this.notification.error('Failed to save the validation. Please try again.');
    } finally {
      this.isSavingValidation.set(false);
    }
  }
}
