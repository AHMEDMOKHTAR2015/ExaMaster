namespace QuizMaster.Application.Realtime;

// Tells signed-in people, live, that something of theirs changed. The message is only a signal ("look again"): the
// client re-reads through the API, which stays the one source of truth and applies every permission, so nothing that
// travels over the socket needs protecting. Best-effort: a person who is not connected simply reads it next time.
public interface IRealtimeNotifier
{
    // Their inbox has new notifications.
    Task InboxChangedAsync(IEnumerable<int> userIds, CancellationToken ct);

    // The submissions they review changed: one arrived, or one was reviewed (the Validation badge).
    Task ReviewQueueChangedAsync(int reviewerId, CancellationToken ct);
}

// For hosts with no live connections (tools, tests): signals go nowhere.
public sealed class NoRealtimeNotifier : IRealtimeNotifier
{
    public Task InboxChangedAsync(IEnumerable<int> userIds, CancellationToken ct) => Task.CompletedTask;
    public Task ReviewQueueChangedAsync(int reviewerId, CancellationToken ct) => Task.CompletedTask;
}
