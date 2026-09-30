export type AppNotificationType =
  | 'homework-approved'
  | 'homework-revision'
  | 'submission-completed'
  | 'submission-needs-review'
  | 'submission-received';

/** Teacher's review state of a submission, as surfaced to a parent notification. */
export type SubmissionReviewStatus = 'approved' | 'revision-requested' | 'pending';

/** Persisted at notifications/{uid}/{id}. */
export interface AppNotification {
  id: string;
  type: AppNotificationType;
  read: boolean;
  createdAt: number;
  assignmentTitle: string;
  assignmentId: string;
  participationId: string;
  feedback?: string;
  /**
   * Present on 'submission-completed' notifications sent to a parent and on
   * 'submission-needs-review' / 'submission-received' notifications sent to a
   * teacher (every submission reaches its reviewer; the type says whether any
   * answer waits for their mark).
   */
  childId?: string;
  childName?: string;
  correctCount?: number;
  wrongCount?: number;
  reviewStatus?: SubmissionReviewStatus;
  timeTakenSeconds?: number;
  /**
   * Present on 'submission-needs-review': how many Explain answers in this
   * submission are waiting for the teacher to mark them.
   */
  pendingReviewCount?: number;
}
