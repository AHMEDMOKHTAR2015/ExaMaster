namespace QuizMaster.Persistence.Repositories;

public class ParticipationRepository(QuizMasterDbContext dbContext) : Repository<Participation>(dbContext)
{
    // Marking reviews every answer, so the answers are part of the aggregate's default load.
    public override IQueryable<Participation> Query() => base.Entity.Include(e => e.Answers);

    // The attempt whose validation decides whether the assignment may be submitted again.
    public Task<Participation?> GetLatestAttemptAsync(int childId, int homeworkId, CancellationToken ct = default)
        => base.Entity.AsNoTracking()
            .Where(e => e.ChildId == childId && e.HomeworkId == homeworkId)
            .OrderByDescending(e => e.HomeworkAttempt)
            .FirstOrDefaultAsync(ct);

    // The attempt already recorded under this key, answers included: a resent submission is answered with it.
    public Task<Participation?> GetBySubmissionKeyAsync(int childId, Guid submissionKey, CancellationToken ct = default)
        => Query().AsNoTracking()
            .SingleOrDefaultAsync(e => e.ChildId == childId && e.SubmissionKey == submissionKey, ct);
}
