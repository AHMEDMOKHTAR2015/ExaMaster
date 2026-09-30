using Microsoft.Extensions.Logging;
using QuizMaster.Domain.Participations.Events;

namespace QuizMaster.Application.Realtime;

// A submission joins its reviewer's queue, and a review can take it off (or leave it with answers still unmarked):
// either way the reviewer's badge is out of date. Best-effort, after the change is committed, like notifications.
public class SignalReviewQueueOnSubmissionHandler(IRealtimeNotifier _notifier, ILogger<SignalReviewQueueOnSubmissionHandler> _logger)
    : INotificationHandler<QuizSubmitted>
{
    public Task Handle(QuizSubmitted notification, CancellationToken ct)
        => RealtimeSignals.SafelyAsync(_logger, notification.Participation.ReviewerId,
            reviewerId => _notifier.ReviewQueueChangedAsync(reviewerId, ct));
}

public class SignalReviewQueueOnReviewHandler(IRealtimeNotifier _notifier, ILogger<SignalReviewQueueOnReviewHandler> _logger)
    : INotificationHandler<SubmissionReviewed>
{
    public Task Handle(SubmissionReviewed notification, CancellationToken ct)
        => RealtimeSignals.SafelyAsync(_logger, notification.Participation.ReviewerId,
            reviewerId => _notifier.ReviewQueueChangedAsync(reviewerId, ct));
}

internal static class RealtimeSignals
{
    public static async Task SafelyAsync(ILogger logger, int? reviewerId, Func<int, Task> signal)
    {
        if (reviewerId is not { } id)
            return;
        try
        {
            await signal(id);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Could not signal reviewer {ReviewerId}", id);
        }
    }
}
