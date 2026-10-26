using Blocks.Core;

namespace QuizMaster.API.Realtime;

// Which open page (connection), of which person, is watching which teaching room.
//insight - SignalR adds a connection to a group, or removes it, only by the connection's id, and a removed student must
// leave the room's group at once, from the server, whatever their browser does. This is how the server finds those ids.
// It lives in memory, so it serves one API instance: scaling out needs the backplane NotificationsHub mentions AND this
// registry in a shared store.
public sealed class TeachingRoomConnections
{
    private const int LockStripes = 64;

    private readonly AsyncLock[] _locks = Enumerable.Range(0, LockStripes).Select(_ => new AsyncLock()).ToArray();
    private readonly Lock _gate = new();
    private readonly Dictionary<string, Watcher> _watchers = new();    // by connection id

    private sealed record Watcher(int UserId, HashSet<int> RoomIds);

    //insight - joining, admitting and removing all hold the room's lock: a join that read "approved" from the database
    // cannot add its connection to the group after a removal committed meanwhile has already looked for it
    public Task<AsyncLock> LockAsync(int roomId) => _locks[(uint)roomId % LockStripes].LockAsync();

    public void Watch(string connectionId, int userId, int roomId)
    {
        lock (_gate)
        {
            if (!_watchers.TryGetValue(connectionId, out var watcher))
                _watchers[connectionId] = watcher = new Watcher(userId, []);
            watcher.RoomIds.Add(roomId);
        }
    }

    public void Forget(string connectionId, int roomId)
    {
        lock (_gate)
        {
            if (_watchers.TryGetValue(connectionId, out var watcher) && watcher.RoomIds.Remove(roomId) && watcher.RoomIds.Count == 0)
                _watchers.Remove(connectionId);
        }
    }

    // The page closed or lost its connection; SignalR takes it out of its groups itself.
    public void Drop(string connectionId)
    {
        lock (_gate)
            _watchers.Remove(connectionId);
    }

    // The pages this person has open on this room.
    public IReadOnlyList<string> Watching(int roomId, int userId)
    {
        lock (_gate)
            return _watchers.Where(entry => entry.Value.UserId == userId && entry.Value.RoomIds.Contains(roomId)).Select(entry => entry.Key).ToList();
    }

    // Every page open on this room, admitted or not.
    public IReadOnlyList<string> Watching(int roomId)
    {
        lock (_gate)
            return _watchers.Where(entry => entry.Value.RoomIds.Contains(roomId)).Select(entry => entry.Key).ToList();
    }
}
