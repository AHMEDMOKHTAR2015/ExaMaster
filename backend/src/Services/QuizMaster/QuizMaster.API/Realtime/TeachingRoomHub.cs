using Blocks.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using QuizMaster.Application.Features.TeachingRooms.GetTeachingRoomAdmission;
using QuizMaster.Application.Features.TeachingRooms.GetTeachingRoomState;
using QuizMaster.Application.Features.TeachingRooms.Shared;

namespace QuizMaster.API.Realtime;

// The live board of the teaching rooms (/hubs/teaching-room). Each room is a SignalR group named "TeachingRoom-{id}", and
// the board's state is sent to that group alone (ITeachingRoomBroadcaster → SignalRTeachingRoomBroadcaster).
//insight - a connection gets into a room's group ONLY through JoinRoom, which builds the group name from the room id itself
// and asks the database, as the caller, whether they present the room or were approved in it. No group name and no
// membership is ever taken from the client. A reconnecting client is a new connection, outside every group, until it joins
// again, and that join returns the current state.
[Authorize(Roles = Role.Teacher + "," + Role.Student)]
public sealed class TeachingRoomHub(ISender _sender, TeachingRoomConnections _connections) : Hub
{
    public const string Path = "/hubs/teaching-room";

    // Method names the client subscribes to.
    public const string CurrentItemChanged = "currentItemChanged";       // TeachingRoomStateDto, to the room's group
    public const string Admitted = "admitted";                           // TeachingRoomStateDto, to the pages of a student just let in
    public const string Removed = "removed";                             // room id, to the pages of a student turned away or removed
    public const string JoinRequestsChanged = "joinRequestsChanged";     // room id, to the presenting teacher's pages (a signal)
    public const string RoomEnded = "roomEnded";                         // room id, to every page open on the room

    public static string GroupName(int roomId) => $"TeachingRoom-{roomId}";

    // Opens a room on this page: the presenting teacher and approved students join its group and receive the board; a
    // waiting or turned-away student is only watched, so the teacher's decision reaches them live; anyone else gets None.
    public async Task<JoinTeachingRoomResult> JoinRoom(int roomId)
    {
        if (roomId <= 0)
            return new JoinTeachingRoomResult(TeachingRoomAdmission.None, null);

        var userId = int.Parse(Context.UserIdentifier!);              // the NameIdentifier UserClaimsTransformation adds
        using (await _connections.LockAsync(roomId))
        {
            // watched before the database is read: an approval committed meanwhile finds this page and lets it in
            _connections.Watch(Context.ConnectionId, userId, roomId);

            var admission = (await _sender.Send(new GetTeachingRoomAdmissionQuery(roomId))).Admission;
            if (admission == TeachingRoomAdmission.None)
            {
                _connections.Forget(Context.ConnectionId, roomId);
                return new JoinTeachingRoomResult(admission, null);
            }
            if (!admission.IsAdmitted())
                return new JoinTeachingRoomResult(admission, null);

            // in the group before the state is read: a move committed meanwhile is either in this read or in a broadcast
            // this connection now receives (the client keeps the higher revision)
            var group = GroupName(roomId);
            await Groups.AddToGroupAsync(Context.ConnectionId, group);
            try
            {
                var state = await _sender.Send(new GetTeachingRoomStateQuery(roomId));
                return new JoinTeachingRoomResult(admission, state.State);
            }
            catch (HttpException)                                       // the room was ended meanwhile
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, group);
                _connections.Forget(Context.ConnectionId, roomId);
                return new JoinTeachingRoomResult(TeachingRoomAdmission.None, null);
            }
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _connections.Drop(Context.ConnectionId);                      // SignalR takes the connection out of its groups itself
        await base.OnDisconnectedAsync(exception);
    }
}
