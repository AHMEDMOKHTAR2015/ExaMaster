using Microsoft.AspNetCore.SignalR;
using QuizMaster.Application.Realtime;

namespace QuizMaster.API.Realtime;

public sealed class SignalRRealtimeNotifier(IHubContext<NotificationsHub> _hub) : IRealtimeNotifier
{
    public Task InboxChangedAsync(IEnumerable<int> userIds, CancellationToken ct)
        => _hub.Clients.Users(userIds.Select(id => id.ToString()).ToList()).SendAsync(NotificationsHub.InboxChanged, ct);

    public Task ReviewQueueChangedAsync(int reviewerId, CancellationToken ct)
        => _hub.Clients.User(reviewerId.ToString()).SendAsync(NotificationsHub.ReviewQueueChanged, ct);
}
