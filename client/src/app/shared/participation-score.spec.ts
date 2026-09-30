/**
 * Pure-function tests for score resolution. No TestBed/DI — the logic is static
 * and deterministic (same approach as `complete-question.spec.ts`).
 */

import { ParticipationRecord } from '../models';
import {
  toCompletedQuizProgress,
  participationPendingReviewCount,
  participationScorePercent,
} from './participation-score';

function record(over: Partial<ParticipationRecord> = {}): ParticipationRecord {
  return {
    id: 'p1', type: 'quiz', quizId: 1, childId: 'c1', stageId: 's1', classId: 'cl1',
    score: 3, status: 'completed', startedAt: 0, endedAt: 1_000, correctCount: 3, wrongCount: 1,
    ...over
  };
}

describe('participationScorePercent', () => {
  it('prefers the weighted scorePercent when present', () => {
    expect(participationScorePercent(record({ scorePercent: 85 }))).toBe(85);
  });

  it('uses scorePercent even when it is 0, rather than falling back', () => {
    expect(participationScorePercent(record({ scorePercent: 0 }))).toBe(0);
  });

  it('falls back to the correct/total ratio for records predating weighted scoring', () => {
    expect(participationScorePercent(record({ scorePercent: undefined }))).toBe(75);
  });

  it('returns 0 rather than dividing by zero when nothing was auto-graded', () => {
    expect(participationScorePercent(
      record({ scorePercent: undefined, correctCount: 0, wrongCount: 0 })
    )).toBe(0);
  });
});

describe('participationPendingReviewCount', () => {
  it('reports 0 when the field is absent', () => {
    expect(participationPendingReviewCount(record())).toBe(0);
  });

  it('reports the recorded count', () => {
    expect(participationPendingReviewCount(record({ pendingReviewCount: 2 }))).toBe(2);
  });
});

describe('toCompletedQuizProgress', () => {
  it('shows an attempt with its weighted score, date and time taken', () => {
    const row = toCompletedQuizProgress(record({ quizName: 'Science quiz', startedAt: 1_000, endedAt: 43_000, scorePercent: 88 }));

    expect(row.quizName).toBe('Science quiz');
    expect(row.percentage).toBe(88);
    expect(row.completedAt).toEqual(new Date(43_000));
    expect(row.timeTaken).toBe(42);
  });

  it('names an assignment by its own title', () => {
    expect(toCompletedQuizProgress(record({ quizName: 'Unit 4', homeworkTitle: 'Week 1 homework' })).quizName).toBe('Week 1 homework');
  });

  it('counts only auto-graded questions in N/M, and says what still waits for the teacher', () => {
    const row = toCompletedQuizProgress(record({ correctCount: 2, wrongCount: 1, pendingReviewCount: 2 }));

    expect([row.score, row.autoGradedCount, row.pendingReviewCount, row.totalQuestions]).toEqual([2, 3, 2, 5]);
  });

  it('carries the teacher\'s verdict', () => {
    const row = toCompletedQuizProgress(record({ validation: { status: 'rejected', validatedBy: 't', validatedAt: 1 } }));
    expect(row.validationStatus).toBe('rejected');
    expect(toCompletedQuizProgress(record()).validationStatus).toBeNull();
  });
});
