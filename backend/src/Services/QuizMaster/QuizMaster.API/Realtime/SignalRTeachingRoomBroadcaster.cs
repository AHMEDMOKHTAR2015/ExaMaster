using Microsoft.AspNetCore.SignalR;
using QuizMaster.Application.Realtime;

namespace QuizMaster.API.Realtime;

public sealed class SignalRTeachingRoomBroadcaster(IHubContext<TeachingRoomHub> _hub, TeachingRoomConnections _connections)
    : ITeachingRoomBroadcaster
{
    public Task CurrentItemChangedAsync(TeachingRoomStateDto state, CancellationToken ct)
        => _hub.Clients.Group(TeachingRoomHub.GroupName(state.RoomId)).SendAsync(TeachingRoomHub.CurrentItemChanged, state, ct);

    public async Task AdmitAsync(int roomId, int studentId, TeachingRoomStateDto state, CancellationToken ct)
    {
        IReadOnlyList<string> pages;
        using (await _connections.LockAsync(roomId))
        {
            pages = _connections.Watching(roomId, studentId);
            foreach (var connectionId in pages)
                await _hub.Groups.AddToGroupAsync(connectionId, TeachingRoomHub.GroupName(roomId), ct);
        }
        if (pages.Count > 0)
            await _hub.Clients.Clients(pages).SendAsync(TeachingRoomHub.Admitted, state, ct);
    }

    public async Task ExpelAsync(int roomId, int studentId, CancellationToken ct)
    {
        IReadOnlyList<string> pages;
        using (await _connections.LockAsync(roomId))
        {
            pages = _connections.Watching(roomId, studentId);
            foreach (var connectionId in pages)
                await _hub.Groups.RemoveFromGroupAsync(connectionId, TeachingRoomHub.GroupName(roomId), ct);
        }
        // they stay watched: if the teacher admits them again, these pages are let back in
        if (pages.Count > 0)
            await _hub.Clients.Clients(pages).SendAsync(TeachingRoomHub.Removed, roomId, ct);
    }

    public async Task JoinRequestsChangedAsync(int roomId, int teacherId, CancellationToken ct)
    {
        var pages = _connections.Watching(roomId, teacherId);
        if (pages.Count > 0)
            await _hub.Clients.Clients(pages).SendAsync(TeachingRoomHub.JoinRequestsChanged, roomId, ct);
    }

    public async Task EndedAsync(int roomId, CancellationToken ct)
    {
        IReadOnlyList<string> pages;
        using (await _connections.LockAsync(roomId))
        {
            pages = _connections.Watching(roomId);
            foreach (var connectionId in pages)
            {
                await _hub.Groups.RemoveFromGroupAsync(connectionId, TeachingRoomHub.GroupName(roomId), ct);
                _connections.Forget(connectionId, roomId);
            }
        }
        if (pages.Count > 0)
            await _hub.Clients.Clients(pages).SendAsync(TeachingRoomHub.RoomEnded, roomId, ct);
    }
}
