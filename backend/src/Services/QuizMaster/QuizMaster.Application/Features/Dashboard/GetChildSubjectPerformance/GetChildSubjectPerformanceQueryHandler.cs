using QuizMaster.Application.Features.Dashboard.GetMySubjectPerformance;

namespace QuizMaster.Application.Features.Dashboard.GetChildSubjectPerformance;

public class GetChildSubjectPerformanceQueryHandler(QuizMasterDbContext _dbContext, IClaimsProvider _claimsProvider)
    : IRequestHandler<GetChildSubjectPerformanceQuery, IReadOnlyList<SubjectPerformanceDto>>
{
    private const int Months = 12;

    //insight - the child is found through the tenant-filtered Users set AND the caller's own id as their parent, so a
    // parent can only ever read their own children; the procedure then pins its reads to that child's tenant itself
    public async Task<IReadOnlyList<SubjectPerformanceDto>> Handle(GetChildSubjectPerformanceQuery query, CancellationToken ct)
    {
        var parentId = _claimsProvider.GetUserId();

        var childSignInUid = await _dbContext.Users.AsNoTracking()
            .Where(user => user.Id == query.ChildId && user.ParentId == parentId)
            .Select(user => user.SignInUid)
            .SingleOrDefaultAsync(ct)
            ?? throw new ForbiddenException("You can only see your own children's progress.");

        return await _dbContext.Database
            .SqlQuery<SubjectPerformanceDto>($"EXEC dbo.GetStudentSubjectPerformance @SignInUid = {childSignInUid}, @Months = {Months}")
            .ToListAsync(ct);
    }
}
