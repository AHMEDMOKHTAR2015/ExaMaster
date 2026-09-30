namespace QuizMaster.Application.Features.Notifications.ListMyNotifications;

// The caller's own inbox, newest first. The app showed the latest 50 and live-updated them; a client polls this
// (cheap: one indexed range read) and uses UnreadCount for the badge.
public record ListMyNotificationsQuery(int Limit = ListMyNotificationsQuery.DefaultLimit) : IQuery<ListMyNotificationsResponse>
{
    public const int DefaultLimit = 50;
}

public record ListMyNotificationsResponse(IReadOnlyList<NotificationDto> Notifications, int UnreadCount);

public class ListMyNotificationsQueryValidator : AbstractValidator<ListMyNotificationsQuery>
{
    public ListMyNotificationsQueryValidator()
    {
        RuleFor(q => q.Limit).InclusiveBetween(1, Paging.MaxPageSize);
    }
}
