export interface QuizAnswerResult {
  questionId: number;
  correctOptionId: number | null;
  /** Complete-only: correct keyword per blank, ordered by blank index. */
  correctBlanks?: string[] | null;
  /** Explain-only: the teacher's model answer, as rich HTML. */
  referenceAnswer?: string | null;
}
