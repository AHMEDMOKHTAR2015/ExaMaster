using QuizMaster.Application.Realtime;
using Microsoft.Extensions.Logging;

namespace QuizMaster.Application.Features.Notifications.Shared;

// Saves notifications for an event that has already been committed.
//insight - best-effort by design, as in the app: domain events are dispatched AFTER the submission or verdict is saved,
// so a notification that fails must be logged, not reported to the student as a failed submission
public class NotificationSender(
    Repository<Notification> _notificationRepository, Repository<User> _userRepository, IRealtimeNotifier _realtime, ILogger<NotificationSender> _logger)
{
    public async Task SendAsync(Participation participation, Func<string, IEnumerable<Notification>> build, CancellationToken ct)
    {
        try
        {
            // the child's name as it is now, snapshotted into the message
            var childName = await _userRepository.QueryNotTracked()
                .Where(user => user.Id == participation.ChildId)
                .Select(user => user.DisplayName)
                .SingleOrDefaultAsync(ct) ?? "A student";

            var notifications = build(childName).ToList();
            if (notifications.Count == 0)
                return;

            await _notificationRepository.AddRangeAsync(notifications, ct);
            await _notificationRepository.SaveChangesAsync(ct);

            // saved first: a recipient who reads on the signal must find them
            await _realtime.InboxChangedAsync(notifications.Select(notification => notification.RecipientId).Distinct(), ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Could not send the notifications for participation {ParticipationId}", participation.Id);
        }
    }
}
