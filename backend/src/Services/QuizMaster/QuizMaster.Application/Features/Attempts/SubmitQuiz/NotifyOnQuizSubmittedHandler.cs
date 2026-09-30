using QuizMaster.Domain.Participations.Events;
using QuizMaster.Application.Features.Notifications.Shared;

namespace QuizMaster.Application.Features.Attempts.SubmitQuiz;

// The parent hears that their child finished; the reviewer hears when answers are waiting for a person to mark.
public class NotifyOnQuizSubmittedHandler(NotificationSender _sender) : INotificationHandler<QuizSubmitted>
{
    public Task Handle(QuizSubmitted notification, CancellationToken ct)
        => _sender.SendAsync(notification.Participation,
            childName => Notification.ForSubmission(notification.Participation, childName, notification.Action), ct);
}
