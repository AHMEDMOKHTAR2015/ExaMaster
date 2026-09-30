/**
 * Resolving a submission's score for display.
 *
 * The server keeps one record per submitted attempt (a `ParticipationRecord`),
 * and its `scorePercent` rises as a teacher marks Explain/Complete answers, so
 * every screen reads the score from there — never from a copy.
 *
 * Pure functions only — no Angular, no HTTP (mirrors `shared/quiz-runner.ts`).
 */

import { CompletedQuiz, ParticipationRecord, ParticipationValidation } from '../models';

/**
 * A submission's score as a 0–100 percentage.
 *
 * Prefers the weighted `scorePercent` written at submission (and rewritten when
 * a teacher grades). Records predating weighted scoring have no `scorePercent`,
 * so those fall back to the old correct/total ratio.
 */
export function participationScorePercent(record: ParticipationRecord): number {
  if (typeof record.scorePercent === 'number') return record.scorePercent;
  const total = record.correctCount + record.wrongCount;
  return total > 0 ? Math.round((record.correctCount / total) * 100) : 0;
}

/** Answers in a submission still waiting on a teacher's mark. */
export function participationPendingReviewCount(record: ParticipationRecord): number {
  return record.pendingReviewCount ?? 0;
}

/** A completed-quiz row enriched with the freshest score we can resolve for it. */
export interface CompletedQuizProgress extends CompletedQuiz {
  /**
   * Auto-graded questions in this attempt. `0` means every question needs a
   * human mark, so a "N correct out of M" figure would be meaningless and
   * callers should hide it.
   */
  autoGradedCount: number;
  /** Answers still awaiting a teacher's mark; `0` once fully graded. */
  pendingReviewCount: number;
  /** The teacher's review, if one has been recorded; `null` when unreviewed. */
  validationStatus: ParticipationValidation['status'] | null;
}

/**
 * One submitted attempt as a row of the student's "Completed quizzes" list.
 *
 * `score` and `autoGradedCount` describe the auto-graded questions only (the
 * "N/M" figure); `percentage` is the weighted score so far, which rises once a
 * teacher marks the remaining answers.
 */
export function toCompletedQuizProgress(record: ParticipationRecord): CompletedQuizProgress {
  const autoGradedCount = record.correctCount + record.wrongCount;
  return {
    quizId: record.quizId,
    quizName: record.homeworkTitle || record.quizName || `Quiz #${record.quizId}`,
    score: record.correctCount,
    totalQuestions: autoGradedCount + participationPendingReviewCount(record),
    percentage: participationScorePercent(record),
    completedAt: new Date(record.endedAt),
    timeTaken: Math.max(0, Math.round((record.endedAt - record.startedAt) / 1000)),
    autoGradedCount,
    pendingReviewCount: participationPendingReviewCount(record),
    validationStatus: record.validation?.status ?? null
  };
}
