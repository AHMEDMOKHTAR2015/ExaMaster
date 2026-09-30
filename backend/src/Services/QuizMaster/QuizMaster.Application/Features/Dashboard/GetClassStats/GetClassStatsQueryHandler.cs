using QuizMaster.Application.Features.Participations.Shared;

namespace QuizMaster.Application.Features.Dashboard.GetClassStats;

public class GetClassStatsQueryHandler(QuizMasterDbContext _dbContext)
    : IRequestHandler<GetClassStatsQuery, ClassStatsResponse>
{
    public async Task<ClassStatsResponse> Handle(GetClassStatsQuery query, CancellationToken ct)
    {
        if (!await _dbContext.Classes.AnyAsync(classGroup => classGroup.Id == query.Id, ct))
            throw new NotFoundException("Class not found");

        var submissions = _dbContext.Participations.Where(participation => participation.ClassId == query.Id);

        return new ClassStatsResponse(
            query.Id,
            Students: await _dbContext.Users.CountAsync(user => user.ClassId == query.Id && user.IsActive, ct),
            Submissions: await submissions.CountAsync(ct),
            AverageScorePercent: await submissions.AverageAsync(participation => (double?)participation.ScorePercent, ct),
            AwaitingReview: await submissions.AwaitingReview().CountAsync(ct));
    }
}
