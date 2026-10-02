import { QuestionSemester } from '../services/admin/quizzes/quiz-admin.service';
import { CompleteSegment } from '../models/question';

export interface QuizAdminItem {
  id: number;
  name: string;
  description: string;
  stageId?: string;
  /** Grade this quiz targets (Grade.id), nested within the stage. */
  gradeId?: string;
  classId?: string;
  /** Subject this quiz belongs to (Subject.id). */
  subjectId?: string;
  semester?: QuestionSemester;
  /**
   * The teacher who reviews attempts at this quiz — their **auth uid**, not
   * their `teachers/{id}`.
   *
   * A bank quiz reaches students without anyone assigning it, so unlike a
   * homework there is no `createdBy` to say whose queue a submission lands in.
   * Without this, any answer needing a human mark (Explain, Complete) would sit
   * pending with nobody able to reach it. `submitQuiz` copies this onto the
   * participation record's `teacherId`, which is what both the review-queue
   * badge and the Validation tab key off.
   *
   * The uid, specifically, because that is what `ParticipationRecord.teacherId`
   * and `reviewQueues/{teacherId}` already mean — a `teachers` record is a
   * roster entry and may not even have a sign-in.
   *
   * Optional on the type for back-compat with quizzes saved before this existed;
   * the admin builder requires it on every save.
   */
  reviewerId?: string;
  /** Reviewer's display name, denormalized so lists need no lookup. */
  reviewerName?: string;
}

export interface QuizAdminPayload extends QuizAdminItem {
  config: Record<string, unknown>;
  Question: number[];
}

export interface QuestionOption {
  id: number;
  name: string;
}

export interface QuestionAdminItem {
  id: number;
  /**
   * Plain display text. For Complete this is the masked passage preview; for
   * Explain it is the plain-text flattening of `subjectHtml`. Never markup and
   * never the answer — the bank's search/tree/picker surfaces all print it raw.
   */
  name: string;
  questionTypeId: number;
  options: QuestionOption[];
  /** Complete-only: parsed passage (static text + blank placeholders), masked (no answers). */
  segments?: CompleteSegment[];
  /** Explain-only: the authored prompt as rich HTML. Safe here — it is not the answer. */
  subjectHtml?: string;
  /** Explain-only: authored share of the whole quiz score, 1–100. Reveals no answer content. */
  weightPercent?: number;
  /** Seconds on the clock for this question; unset means the runtime default applies. */
  duration?: number;
  /** Subject this question belongs to (Subject.id). Keeps the bank single-subject. */
  subjectId?: string;
  /** Educational stage this question targets (Stage.id), e.g. Primary/Preparatory. */
  stageId?: string;
  /** Grade this question targets (Grade.id), nested within the stage. */
  gradeId?: string;
  semester?: QuestionSemester;
  /**
   * Tags of its subject (SubjectTag ids). Left undefined on an update, the API keeps the question's tags; an empty
   * list clears them.
   */
  tagIds?: string[];
}

/**
 * A row in the `/Answers` node — kept separate from `/Questions` so correct
 * answers never reach the client before submission. `correctOptionId` carries a
 * Choose or Right-or-Wrong answer; `correctBlanks` (ordered by blank index)
 * carries a Complete answer; `referenceAnswer` carries an Explain model answer.
 * Exactly one is set per row; the others are written as `null`.
 */
export interface AnswerItem {
  questionId: number;
  correctOptionId: number | null;
  correctBlanks?: string[] | null;
  /** Explain-only: the teacher's model answer, as rich HTML. */
  referenceAnswer?: string | null;
}

/** Answer payload passed to the bank writers — exactly one field per question type. */
export interface QuestionAnswerInput {
  correctOptionId?: number | null;
  correctBlanks?: string[] | null;
  referenceAnswer?: string | null;
}
