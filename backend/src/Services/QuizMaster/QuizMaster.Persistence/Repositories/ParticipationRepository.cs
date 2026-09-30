namespace QuizMaster.Persistence.Repositories;

public class ParticipationRepository(QuizMasterDbContext dbContext) : Repository<Participation>(dbContext)
{
    // Marking reviews every answer, so the answers are part of the aggregate's default load.
    public override IQueryable<Participation> Query() => base.Entity.Include(e => e.Answers);

    // The attempt whose validation decides whether the assignment may be submitted again.
    public Task<Participation?> GetLatestAttemptAsync(int childId, int homeworkId, CancellationToken ct = default)
        => base.Entity.AsNoTracking()
            .Where(e => e.ChildId == childId && e.HomeworkId == homeworkId)
            .OrderByDescending(e => e.EndedOn)
            .FirstOrDefaultAsync(ct);
}
