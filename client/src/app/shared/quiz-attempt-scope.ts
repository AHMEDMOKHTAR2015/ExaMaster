/**
 * How one student's attempt at one quiz is addressed.
 *
 * `attemptScopeKey` must build the same key as the API's `AttemptScope.KeyFor`
 * (`homework:12`, `teacher:5`, `bank:3`): the quiz list matches the student's
 * locks to its cards by it.
 *
 * The scope is the *assignment*, not the quiz, whenever there is one — a
 * homework and a practice run of the same underlying quiz are separate attempts
 * with separate containment, and a teacher unlocking one must not silently
 * unlock the other.

 */

/** Identifies which piece of work an attempt belongs to. */
export interface QuizAttemptScope {
  /** `'bank'` quizzes carry a numeric id; teacher-authored ones a document id. */
  source: 'bank' | 'teacher';
  quizId?: number | null;
  teacherQuizId?: string | null;
  homeworkId?: string | null;
}

/**
 * A stable key for the scope above.
 *
 * `homeworkId` wins when present because that is the unit a teacher assigns,
 * tracks and unlocks. Only a standalone practice run falls through to the quiz
 * itself.
 */
export function attemptScopeKey(scope: QuizAttemptScope): string {
  if (scope.homeworkId) return `homework:${scope.homeworkId}`;
  if (scope.source === 'teacher') return `teacher:${scope.teacherQuizId ?? ''}`;
  return `bank:${scope.quizId ?? 0}`;
}
