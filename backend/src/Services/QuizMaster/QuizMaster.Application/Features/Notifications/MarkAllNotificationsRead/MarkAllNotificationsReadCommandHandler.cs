namespace QuizMaster.Application.Features.Notifications.MarkAllNotificationsRead;

public class MarkAllNotificationsReadCommandHandler(Repository<Notification> _notificationRepository)
    : IRequestHandler<MarkAllNotificationsReadCommand, MarkAllNotificationsReadResponse>
{
    // One set-based UPDATE (the tenant filter still applies): the app batched at most the 50 it had loaded.
    public async Task<MarkAllNotificationsReadResponse> Handle(MarkAllNotificationsReadCommand command, CancellationToken ct)
    {
        var marked = await _notificationRepository.Query()
            .Where(notification => notification.RecipientId == command.CreatedById && !notification.IsRead)
            .ExecuteUpdateAsync(set => set.SetProperty(notification => notification.IsRead, true), ct);

        return new MarkAllNotificationsReadResponse(marked);
    }
}
