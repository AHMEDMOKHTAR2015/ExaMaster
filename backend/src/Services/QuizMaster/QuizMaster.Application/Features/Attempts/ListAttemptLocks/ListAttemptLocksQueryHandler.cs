namespace QuizMaster.Application.Features.Attempts.ListAttemptLocks;

public class ListAttemptLocksQueryHandler(QuizMasterDbContext _dbContext)
    : IRequestHandler<ListAttemptLocksQuery, ListAttemptLocksResponse>
{
    public async Task<ListAttemptLocksResponse> Handle(ListAttemptLocksQuery query, CancellationToken ct)
    {
        var locks = _dbContext.AttemptLocks.AsNoTracking();

        if (query.HomeworkId is { } homeworkId)
            locks = locks.Where(attemptLock => attemptLock.HomeworkId == homeworkId);
        if (query.ChildId is { } childId)
            locks = locks.Where(attemptLock => attemptLock.ChildId == childId);
        if (query.BlockingOnly)
            locks = locks.Where(attemptLock => attemptLock.Status != AttemptLockStatus.Released);

        var rows = await locks
            .OrderByDescending(attemptLock => attemptLock.StartedOn)
            .Select(attemptLock => new
            {
                Lock = attemptLock,
                ChildName = _dbContext.Users.Where(user => user.Id == attemptLock.ChildId).Select(user => user.DisplayName).FirstOrDefault()
            })
            .ToListAsync(ct);

        return new ListAttemptLocksResponse(rows.Select(row => row.Lock.Adapt<AttemptLockDto>() with { ChildName = row.ChildName }).ToList());
    }
}
