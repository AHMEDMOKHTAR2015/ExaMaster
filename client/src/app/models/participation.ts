export type ParticipationStatus = 'not-started' | 'in-progress' | 'completed' | 'overdue';

/**
 * One blank's outcome within a Complete question, persisted for review so the
 * per-blank breakdown survives without re-fetching the (mutable) quiz.
 */
export interface ParticipationBlankAnswer {
  index: number;
  userAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
}

/**
 * A teacher's mark for one Explain answer. Recorded per question, unlike
 * {@link ParticipationValidation}, which is a single verdict for the whole
 * submission.
 */
export interface ParticipationManualGrade {
  /** Share of the quiz awarded, between 0 and the answer's `weightPercent`. */
  awardedPercent: number;
  comment?: string;
  /** uid of the teacher who graded. */
  gradedBy: string;
  gradedByName?: string;
  gradedAt: number;
}

/**
 * One question's outcome within a participation attempt: what the student
 * answered and what the correct answer was. Persisted so teachers/admins can
 * review the attempt without re-fetching the (mutable) quiz definition.
 *
 * For Choose and Right-or-Wrong questions the `*OptionId`/`*OptionText` fields
 * carry the answer; for Complete those are `null` and the per-blank breakdown
 * rides on `blanks`; for Explain they are `null` too and the free text rides on
 * `responseText`/`referenceAnswer`.
 */
export interface ParticipationAnswer {
  questionId: number;
  /** Always plain text — for Explain, the flattened subject, not its markup. */
  questionName: string;
  selectedOptionId: number | null;
  selectedOptionText: string | null;
  correctOptionId: number | null;
  correctOptionText: string | null;
  isCorrect: boolean;
  /** Complete-only: per-blank submitted/correct/correctness breakdown. */
  blanks?: ParticipationBlankAnswer[];
  /** Explain-only: the student's rich-HTML response. */
  responseText?: string | null;
  /** Explain-only: the teacher's model answer, captured at submission time. */
  referenceAnswer?: string | null;
  /**
   * This question's share of the quiz, captured at submission time. Frozen on
   * purpose: the teacher grades against the weighting the quiz actually had,
   * even if the question is later re-weighted in the bank.
   */
  weightPercent?: number;
  /**
   * Share actually earned. Auto-graded questions get `weightPercent` or 0 at
   * submission; an Explain answer stays `null` until a teacher grades it.
   */
  earnedPercent?: number | null;
  /** True when this answer needs a human mark before the score is final. */
  requiresReview?: boolean;
  /** Explain-only: the teacher's mark, once recorded. */
  manualGrade?: ParticipationManualGrade;
}

/** Free-form attempt metadata; `answers` is the per-question breakdown. */
export interface ParticipationMetadata {
  answers?: ParticipationAnswer[];
  [key: string]: unknown;
}

/**
 * A teacher's review of a homework submission. Persisted onto the participation
 * record in the by-homework index (`participationsByHomework/{homeworkId}/{id}`)
 * so the teacher-facing validation view can read it back. The auto-calculated
 * `score` is left untouched — this records the human verdict and feedback only.
 */
export interface ParticipationValidation {
  status: 'approved' | 'rejected';
  feedback?: string;
  /** uid of the teacher who validated. */
  validatedBy: string;
  validatedByName?: string;
  validatedAt: number;
}

export interface ParticipationRecord {
  id: string;
  type: 'quiz' | 'homework';
  quizId: number;
  quizName?: string;
  homeworkId?: string;
  homeworkTitle?: string;
  childId: string;
  parentId?: string;
  /**
   * The author of the assignment this submission answers — i.e. who reviews it.
   * Denormalized by `submitQuiz` so the `reviewQueues` aggregate can bucket the
   * record without joining back to `homeworkAssignments`. Absent/null on a
   * standalone practice quiz, and on records written before the aggregate
   * existed (`recomputeReviewQueues` backfills those).
   */
  teacherId?: string | null;
  stageId: string;
  gradeId?: string;
  classId: string;
  /**
   * Raw count of auto-graded questions answered correctly. Explain questions are
   * excluded — they are not auto-gradable, so counting them here would report a
   * pending answer as wrong. Unchanged for quizzes without Explain questions.
   */
  score: number;
  status: ParticipationStatus;
  startedAt: number;
  endedAt: number;
  correctCount: number;
  wrongCount: number;
  /**
   * Weighted 0–100 score known so far: every auto-graded question's share plus
   * any Explain shares a teacher has already awarded. Rises as pending answers
   * get graded. Absent on records written before weighted scoring existed.
   */
  scorePercent?: number;
  /** Explain answers still awaiting a teacher's mark. 0/absent means fully graded. */
  pendingReviewCount?: number;
  metadata?: ParticipationMetadata;
  /** Teacher's review of this submission, when one has been recorded. */
  validation?: ParticipationValidation;
  /**
   * On an attempt read whole: `false` while an assignment's correct answers are
   * withheld from the student (until its due date). Whether each answer was
   * right is still sent; the correct answers are not.
   */
  resultsAvailable?: boolean;
}
