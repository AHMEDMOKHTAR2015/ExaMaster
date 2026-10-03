namespace QuizMaster.Application.Features.Dashboard.GetMySubjectPerformance;

public class GetMySubjectPerformanceQueryHandler(QuizMasterDbContext _dbContext, IClaimsProvider _claimsProvider)
    : IRequestHandler<GetMySubjectPerformanceQuery, IReadOnlyList<SubjectPerformanceDto>>
{
    private const int Months = 12;

    //insight - the sign-in uid comes from the caller's own validated token, never from the request: a student can only
    // ever read their own standing. The procedure pins its reads to that student's tenant itself (no EF query filter there)
    public async Task<IReadOnlyList<SubjectPerformanceDto>> Handle(GetMySubjectPerformanceQuery query, CancellationToken ct)
    {
        var signInUid = _claimsProvider.GetClaimValue(UserClaimsTransformation.AccountUidClaim);

        return await _dbContext.Database
            .SqlQuery<SubjectPerformanceDto>($"EXEC dbo.GetStudentSubjectPerformance @SignInUid = {signInUid}, @Months = {Months}")
            .ToListAsync(ct);
    }
}
