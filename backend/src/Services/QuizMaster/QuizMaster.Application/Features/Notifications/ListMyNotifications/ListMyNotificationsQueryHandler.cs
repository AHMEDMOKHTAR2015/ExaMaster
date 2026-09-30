namespace QuizMaster.Application.Features.Notifications.ListMyNotifications;

public class ListMyNotificationsQueryHandler(Repository<Notification> _notificationRepository, IClaimsProvider _claimsProvider)
    : IRequestHandler<ListMyNotificationsQuery, ListMyNotificationsResponse>
{
    public async Task<ListMyNotificationsResponse> Handle(ListMyNotificationsQuery query, CancellationToken ct)
    {
        var userId = _claimsProvider.GetUserId();
        var inbox = _notificationRepository.QueryNotTracked().Where(notification => notification.RecipientId == userId);

        var latest = await inbox
            .OrderByDescending(notification => notification.CreatedOn).ThenByDescending(notification => notification.Id)
            .Take(query.Limit)
            .ToListAsync(ct);
        // counted over the whole inbox, not just the page: an unread item older than the latest 50 still counts
        var unreadCount = await inbox.CountAsync(notification => !notification.IsRead, ct);

        return new ListMyNotificationsResponse(latest.Adapt<List<NotificationDto>>(), unreadCount);
    }
}
