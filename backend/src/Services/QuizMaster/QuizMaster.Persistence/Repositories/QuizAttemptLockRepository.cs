namespace QuizMaster.Persistence.Repositories;

public class QuizAttemptLockRepository(QuizMasterDbContext dbContext) : Repository<QuizAttemptLock>(dbContext)
{
    public Task<QuizAttemptLock?> GetForScopeAsync(int childId, string scopeKey, CancellationToken ct = default)
        => Query().SingleOrDefaultAsync(e => e.ChildId == childId && e.ScopeKey == scopeKey, ct);
}
