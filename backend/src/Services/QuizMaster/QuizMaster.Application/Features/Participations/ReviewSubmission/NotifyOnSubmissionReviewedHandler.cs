using QuizMaster.Domain.Participations.Events;
using QuizMaster.Application.Features.Notifications.Shared;

namespace QuizMaster.Application.Features.Participations.ReviewSubmission;

// The student and their parent hear the verdict, once: re-saving marks without changing the verdict or feedback sends nothing.
public class NotifyOnSubmissionReviewedHandler(NotificationSender _sender) : INotificationHandler<SubmissionReviewed>
{
    public Task Handle(SubmissionReviewed notification, CancellationToken ct)
        => notification.VerdictChanged
            ? _sender.SendAsync(notification.Participation,
                childName => Notification.ForVerdict(notification.Participation, childName, notification.Action), ct)
            : Task.CompletedTask;
}
