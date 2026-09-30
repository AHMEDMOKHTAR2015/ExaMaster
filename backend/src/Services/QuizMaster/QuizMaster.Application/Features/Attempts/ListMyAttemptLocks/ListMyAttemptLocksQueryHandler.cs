namespace QuizMaster.Application.Features.Attempts.ListMyAttemptLocks;

public class ListMyAttemptLocksQueryHandler(QuizAttemptLockRepository _attemptLockRepository, IClaimsProvider _claimsProvider)
    : IRequestHandler<ListMyAttemptLocksQuery, ListMyAttemptLocksResponse>
{
    public async Task<ListMyAttemptLocksResponse> Handle(ListMyAttemptLocksQuery query, CancellationToken ct)
    {
        var userId = _claimsProvider.GetUserId();

        var locks = await _attemptLockRepository.QueryNotTracked()
            .Where(attemptLock => attemptLock.ChildId == userId)
            .OrderByDescending(attemptLock => attemptLock.StartedOn)
            .ToListAsync(ct);

        return new ListMyAttemptLocksResponse(locks.Adapt<List<AttemptLockDto>>());
    }
}
