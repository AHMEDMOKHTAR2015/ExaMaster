using Microsoft.Extensions.Logging;

namespace QuizMaster.Application.Realtime;

// The live board of a teaching room (API/Realtime/TeachingRoomHub).
//insight - unlike IRealtimeNotifier's signals, a move carries the room's state (the lesson on the board), so that every
// screen follows at once without thirty re-reads per click. It is therefore sent only to the room's group, which the hub
// alone fills: the presenting teacher and the students they approved, checked against the database on every join, and
// changed at once when the teacher admits or removes someone.
public interface ITeachingRoomBroadcaster
{
    // The teacher moved: the new state, to the room's group only.
    Task CurrentItemChangedAsync(TeachingRoomStateDto state, CancellationToken ct);

    // The student was approved: every page they have open on this room joins its group and receives the state.
    Task AdmitAsync(int roomId, int studentId, TeachingRoomStateDto state, CancellationToken ct);

    // The student was turned away or removed: every page they have open on this room leaves its group at once.
    Task ExpelAsync(int roomId, int studentId, CancellationToken ct);

    // A student asked to join: the teacher's pages on this room re-read the requests (a signal only).
    Task JoinRequestsChangedAsync(int roomId, int teacherId, CancellationToken ct);

    // The teacher ended the room: every page open on it hears so.
    Task EndedAsync(int roomId, CancellationToken ct);
}

// For hosts with no live connections (tools, tests): the board goes nowhere.
public sealed class NoTeachingRoomBroadcaster : ITeachingRoomBroadcaster
{
    public Task CurrentItemChangedAsync(TeachingRoomStateDto state, CancellationToken ct) => Task.CompletedTask;
    public Task AdmitAsync(int roomId, int studentId, TeachingRoomStateDto state, CancellationToken ct) => Task.CompletedTask;
    public Task ExpelAsync(int roomId, int studentId, CancellationToken ct) => Task.CompletedTask;
    public Task JoinRequestsChangedAsync(int roomId, int teacherId, CancellationToken ct) => Task.CompletedTask;
    public Task EndedAsync(int roomId, CancellationToken ct) => Task.CompletedTask;
}

internal static class TeachingRoomSignals
{
    // Best-effort after the save, like every signal: a screen that missed a move catches up when it reconnects (JoinRoom
    // returns the current state). Removing a student is deliberately NOT sent through here: see RejectTeachingRoomMember.
    public static async Task SafelyAsync(ILogger logger, int roomId, Func<Task> broadcast)
    {
        try
        {
            await broadcast();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Could not update the live board of teaching room {RoomId}", roomId);
        }
    }
}
