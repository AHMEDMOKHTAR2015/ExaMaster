import { QuizInfo } from '../interfaces';
import { User } from '../models';

/**
 * Pure filters for the quiz list — kept out of components so the rules are
 * reusable and easy to test in isolation.
 */

export function filterIncompleteQuizzes(quizzes: QuizInfo[], completedQuizIds: number[]): QuizInfo[] {
  return quizzes.filter(q => !completedQuizIds.includes(q.id));
}

/**
 * Visibility rule for a child user, based on stage assignment.
 *  - Open quiz (no stageId) → visible to every child
 *  - Stage-scoped quiz → visible only to children in that stage
 */
export function filterQuizzesForChildStage(quizzes: QuizInfo[], stageId: string): QuizInfo[] {
  return quizzes.filter(q => !q.stageId || q.stageId === stageId);
}

export function filterAvailableQuizzesForUser(
  quizzes: QuizInfo[],
  completedQuizIds: number[],
  user: User | null
): QuizInfo[] {
  const incomplete = filterIncompleteQuizzes(quizzes, completedQuizIds);
  if (user?.accountType === 'child' && user.stageId) {
    return filterQuizzesForChildStage(incomplete, user.stageId);
  }
  return incomplete;
}

export function isOverdue(dueAt: number, now: Date = new Date()): boolean {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return dueAt < startOfToday.getTime();
}
