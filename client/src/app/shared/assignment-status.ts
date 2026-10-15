import { HomeworkAssignment } from '../models';

/**
 * Where a student stands on one assignment, as their parent reads it:
 *  - `todo`      not submitted, still open
 *  - `overdue`   not submitted, past its due date
 *  - `awaiting`  submitted, an answer still waits for the teacher's mark
 *  - `approved` / `rejected`  the teacher's verdict
 *  - `submitted` submitted and fully marked, no verdict recorded
 */
export type AssignmentProgressStatus = 'todo' | 'overdue' | 'awaiting' | 'approved' | 'rejected' | 'submitted';

/** The filter buckets the child profile offers: what is still to do, and what is done. */
export type AssignmentStatusGroup = 'open' | 'done';

export function assignmentProgressStatus(
  assignment: Pick<HomeworkAssignment, 'dueAt' | 'submission'>,
  now: number = Date.now()
): AssignmentProgressStatus {
  const submission = assignment.submission;
  if (!submission) return assignment.dueAt < now ? 'overdue' : 'todo';
  if (submission.validationStatus === 'approved') return 'approved';
  if (submission.validationStatus === 'rejected') return 'rejected';
  if (submission.pendingReviewCount > 0) return 'awaiting';
  return 'submitted';
}

export function assignmentStatusGroup(status: AssignmentProgressStatus): AssignmentStatusGroup {
  return status === 'todo' || status === 'overdue' ? 'open' : 'done';
}

/**
 * Open work first (soonest due on top, so what is overdue or nearly due leads), then finished work, most recently
 * submitted first.
 */
export function sortAssignmentsForReview(assignments: HomeworkAssignment[], now: number = Date.now()): HomeworkAssignment[] {
  return [...assignments].sort((a, b) => {
    const aOpen = assignmentStatusGroup(assignmentProgressStatus(a, now)) === 'open';
    const bOpen = assignmentStatusGroup(assignmentProgressStatus(b, now)) === 'open';
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    if (aOpen) return a.dueAt - b.dueAt;
    return (b.submission?.endedAt ?? 0) - (a.submission?.endedAt ?? 0);
  });
}
