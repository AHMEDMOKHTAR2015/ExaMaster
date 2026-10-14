using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using QuizMasterPro.Security;

namespace QuizMaster.API.Realtime;

// The live channel the app listens on (/hubs/notifications). Server-to-client only: it carries "look again" signals
// (see IRealtimeNotifier), addressed to a person by their user id — the NameIdentifier UserClaimsTransformation adds
// from the database, never anything the browser sends. Each open tab is a connection; all of a person's receive it.
//insight - the app polls for none of these: it reads once when someone signs in or reconnects, then only when a
// signal says something changed, so an idle signed-in tab makes no database queries at all
[Authorize]
public sealed class NotificationsHub : Hub
{
    public const string Path = "/hubs/notifications";

    // Method names the client subscribes to.
    public const string InboxChanged = "inboxChanged";
    public const string ReviewQueueChanged = "reviewQueueChanged";
    public const string AccessRequestsChanged = "accessRequestsChanged";

    // Platform administrators hear about access requests, which come from visitors with no account (nobody's user id
    // to address). The role comes from the caller's own user record (UserClaimsTransformation), read at connect.
    public const string PlatformAdministrators = "platform-administrators";

    public override async Task OnConnectedAsync()
    {
        if (Context.User?.IsInRole(Role.PlatformAdmin) == true)
            await Groups.AddToGroupAsync(Context.ConnectionId, PlatformAdministrators);   // left automatically on disconnect
        await base.OnConnectedAsync();
    }
}
