namespace QuizMaster.Domain.Notifications;

// The app's AppNotificationType, one for one.
public enum NotificationType
{
    SubmissionApproved = 1,          // to the student: their teacher approved it          ('homework-approved')
    SubmissionRejected = 2,          // to the student: their teacher asked for a revision  ('homework-revision')
    SubmissionCompleted = 3,         // to the parent: their child finished a quiz          ('submission-completed')
    SubmissionNeedsReview = 4,       // to the reviewer: answers only a person can mark     ('submission-needs-review')
    SubmissionReceived = 5,          // to the reviewer: a submission arrived, all auto-marked ('submission-received')
    ChildSubmissionApproved = 6,     // to the parent: the teacher approved their child's   ('child-approved')
    ChildSubmissionRejected = 7,     // to the parent: the teacher asked their child to revise ('child-revision')
}
