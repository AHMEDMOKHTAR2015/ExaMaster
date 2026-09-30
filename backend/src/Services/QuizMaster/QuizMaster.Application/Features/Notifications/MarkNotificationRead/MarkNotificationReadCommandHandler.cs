namespace QuizMaster.Application.Features.Notifications.MarkNotificationRead;

public class MarkNotificationReadCommandHandler(Repository<Notification> _notificationRepository)
    : IRequestHandler<MarkNotificationReadCommand, IdResponse>
{
    public async Task<IdResponse> Handle(MarkNotificationReadCommand command, CancellationToken ct)
    {
        var notification = await _notificationRepository.Query()
            .SingleOrDefaultAsync(e => e.Id == command.AggregateId && e.RecipientId == command.CreatedById, ct)
            ?? throw new NotFoundException($"Notification {command.AggregateId} was not found.");

        notification.MarkRead();
        await _notificationRepository.SaveChangesAsync(ct);

        return new IdResponse(notification.Id);
    }
}
