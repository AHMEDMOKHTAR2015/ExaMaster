namespace QuizMaster.Persistence.Repositories;

public class Repository<TEntity>(QuizMasterDbContext dbContext)
    : RepositoryBase<QuizMasterDbContext, TEntity>(dbContext)
    where TEntity : class, IEntity<int>
{
    public async Task<List<TEntity>> GetByIdsAsync(IEnumerable<int> ids, CancellationToken ct = default)
    {
        var distinctIds = ids.Distinct().ToList();
        return await Query().Where(e => distinctIds.Contains(e.Id)).ToListAsync(ct);
    }
}
