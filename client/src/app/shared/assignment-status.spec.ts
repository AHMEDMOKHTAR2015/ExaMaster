import { HomeworkAssignment } from '../models';
import { assignmentProgressStatus, assignmentStatusGroup, sortAssignmentsForReview } from './assignment-status';

const NOW = Date.UTC(2026, 9, 15);
const DAY = 24 * 60 * 60 * 1000;

function assignment(id: string, dueAt: number, submission: HomeworkAssignment['submission'] = null): HomeworkAssignment {
  return {
    id, quizId: 1, title: id, stageId: '1', classId: '1', dueAt, createdBy: '1', createdAt: 0, active: true, submission
  };
}

function submitted(endedAt: number, extra: Partial<NonNullable<HomeworkAssignment['submission']>> = {}) {
  return { participationId: '9', scorePercent: 80, pendingReviewCount: 0, validationStatus: null, endedAt, ...extra };
}

describe('assignmentProgressStatus', () => {
  it('is to-do while unsubmitted and still open', () => {
    expect(assignmentProgressStatus(assignment('a', NOW + DAY), NOW)).toBe('todo');
  });

  it('is overdue once unsubmitted past its due date', () => {
    expect(assignmentProgressStatus(assignment('a', NOW - DAY), NOW)).toBe('overdue');
  });

  it('waits for marks while an answer is pending review', () => {
    expect(assignmentProgressStatus(assignment('a', NOW, submitted(NOW, { pendingReviewCount: 2 })), NOW)).toBe('awaiting');
  });

  it("reports the teacher's verdict ahead of anything else", () => {
    expect(assignmentProgressStatus(assignment('a', NOW, submitted(NOW, { validationStatus: 'approved' })), NOW)).toBe('approved');
    expect(assignmentProgressStatus(assignment('a', NOW, submitted(NOW, { validationStatus: 'rejected', pendingReviewCount: 1 })), NOW)).toBe('rejected');
  });

  it('is submitted when fully marked with no verdict, even past the due date', () => {
    expect(assignmentProgressStatus(assignment('a', NOW - DAY, submitted(NOW - 2 * DAY)), NOW)).toBe('submitted');
  });
});

describe('assignmentStatusGroup', () => {
  it('puts unsubmitted work in open and everything submitted in done', () => {
    expect(assignmentStatusGroup('todo')).toBe('open');
    expect(assignmentStatusGroup('overdue')).toBe('open');
    expect(assignmentStatusGroup('awaiting')).toBe('done');
    expect(assignmentStatusGroup('submitted')).toBe('done');
  });
});

describe('sortAssignmentsForReview', () => {
  it('lists open work soonest-due first, then finished work most recent first', () => {
    const sorted = sortAssignmentsForReview([
      assignment('done-old', NOW, submitted(NOW - 3 * DAY)),
      assignment('open-later', NOW + 5 * DAY),
      assignment('done-new', NOW, submitted(NOW - DAY)),
      assignment('overdue', NOW - DAY)
    ], NOW);

    expect(sorted.map(item => item.id)).toEqual(['overdue', 'open-later', 'done-new', 'done-old']);
  });
});
