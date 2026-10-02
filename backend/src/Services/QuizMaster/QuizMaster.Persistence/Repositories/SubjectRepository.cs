namespace QuizMaster.Persistence.Repositories;

public class SubjectRepository(QuizMasterDbContext dbContext) : Repository<Subject>(dbContext)
{
    // Query() defines the aggregate boundary: every GetByIdAsync loads the subject WITH its tags.
    public override IQueryable<Subject> Query() => base.Entity.Include(e => e.Tags);
    public override IQueryable<Subject> QueryNotTracked() => Query().AsNoTracking();

    // The subjects owning any of these tags. Tags are reached through their subject, so the tenant filter applies.
    public Task<List<Subject>> GetOwnersOfTagsAsync(IReadOnlyCollection<int> tagIds, CancellationToken ct)
        => Query().Where(subject => subject.Tags.Any(tag => tagIds.Contains(tag.Id))).ToListAsync(ct);
}
