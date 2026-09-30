using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace QuizMaster.API.Realtime;

// The live channel the app listens on (/hubs/notifications). Server-to-client only: it carries "look again" signals
// (see IRealtimeNotifier), addressed to a person by their user id — the NameIdentifier UserClaimsTransformation adds
// from the database, never anything the browser sends. Each open tab is a connection; all of a person's receive it.
[Authorize]
public sealed class NotificationsHub : Hub
{
    public const string Path = "/hubs/notifications";

    // Method names the client subscribes to.
    public const string InboxChanged = "inboxChanged";
    public const string ReviewQueueChanged = "reviewQueueChanged";
}
