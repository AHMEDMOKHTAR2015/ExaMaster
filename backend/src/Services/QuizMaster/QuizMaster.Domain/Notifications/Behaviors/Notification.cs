namespace QuizMaster.Domain.Notifications;

public partial class Notification
{
    // Who hears about a submission, and what they are told. The app's SubmissionNotifier made the same decisions.
    public static IReadOnlyList<Notification> ForSubmission(Participation participation, string childName, IQuizMasterAction action)
    {
        var notifications = new List<Notification>();

        if (participation.ParentId is { } parentId)
            notifications.Add(Create(parentId, NotificationType.SubmissionCompleted, participation, childName, null, action));

        //insight - the reviewer hears about every submission to their assignment or bank quiz, as one notification whose
        // type says whether they must act: NeedsReview when an Explain/Complete answer waits for their mark, Received
        // when it was all auto-marked. One per submission, never both, so the bell counts submissions, not rules
        if (participation.ReviewerId is { } reviewerId)
            notifications.Add(Create(reviewerId,
                participation.PendingReviewCount > 0 ? NotificationType.SubmissionNeedsReview : NotificationType.SubmissionReceived,
                participation, childName, null, action));

        return notifications;
    }

    // The student hears the verdict, and so does their parent, who was told at submission that a review was coming.
    public static IReadOnlyList<Notification> ForVerdict(Participation participation, string childName, IQuizMasterAction action)
    {
        var (studentType, parentType) = participation.ValidationStatus switch
        {
            ValidationStatus.Approved => (NotificationType.SubmissionApproved, NotificationType.ChildSubmissionApproved),
            ValidationStatus.Rejected => (NotificationType.SubmissionRejected, NotificationType.ChildSubmissionRejected),
            _ => throw new DomainException("Only a reviewed submission has a verdict to announce.")
        };

        var notifications = new List<Notification>
        {
            Create(participation.ChildId, studentType, participation, childName, participation.ValidationFeedback, action)
        };

        if (participation.ParentId is { } parentId)
            notifications.Add(Create(parentId, parentType, participation, childName, participation.ValidationFeedback, action));

        return notifications;
    }

    // Only the recipient changes it (the endpoints are /me/…), so nothing else to check.
    public void MarkRead()
    {
        IsRead = true;
    }

    private static Notification Create(int recipientId, NotificationType type, Participation participation, string childName, string? feedback, IQuizMasterAction action)
        => new()
        {
            TenantId = participation.TenantId,
            RecipientId = recipientId,
            Type = type,
            ParticipationId = participation.Id,
            HomeworkId = participation.HomeworkId,
            Title = participation.HomeworkTitle ?? participation.QuizName,
            ChildId = participation.ChildId,
            ChildName = childName,
            CorrectCount = participation.CorrectCount,
            WrongCount = participation.WrongCount,
            PendingReviewCount = participation.PendingReviewCount,
            TimeTakenSeconds = Math.Max(0, (int)(participation.EndedOn - participation.StartedOn).TotalSeconds),
            Feedback = feedback,
            CreatedById = action.CreatedById,
            CreatedOn = action.CreatedOn
        };
}
