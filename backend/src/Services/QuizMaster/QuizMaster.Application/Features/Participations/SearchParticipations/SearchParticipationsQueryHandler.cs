using QuizMaster.Application.Features.Participations.Shared;

namespace QuizMaster.Application.Features.Participations.SearchParticipations;

public class SearchParticipationsQueryHandler(QuizMasterDbContext _dbContext, IClaimsProvider _claimsProvider)
    : IRequestHandler<SearchParticipationsQuery, PagedResponse<ParticipationSummaryDto>>
{
    public async Task<PagedResponse<ParticipationSummaryDto>> Handle(SearchParticipationsQuery query, CancellationToken ct)
    {
        var caller = Caller.From(_claimsProvider);
        var participations = _dbContext.Participations.AsNoTracking();

        if (!caller.IsStaff)
            participations = participations.Where(p => p.ChildId == caller.UserId || p.ParentId == caller.UserId);

        if (query.ChildId is { } childId)
            participations = participations.Where(p => p.ChildId == childId);
        if (query.HomeworkId is { } homeworkId)
            participations = participations.Where(p => p.HomeworkId == homeworkId);
        if (query.BankQuizId is { } bankQuizId)
            participations = participations.Where(p => p.BankQuizId == bankQuizId);
        if (query.TeacherQuizId is { } teacherQuizId)
            participations = participations.Where(p => p.TeacherQuizId == teacherQuizId);
        if (query.ReviewerId is { } reviewerId)
            participations = participations.Where(p => p.ReviewerId == reviewerId);
        if (query.AwaitingReview)
            participations = participations.AwaitingReview();
        if (query.Verdict is { } verdict)
            participations = participations.WithVerdict(verdict);
        participations = participations.Matching(query.Filter(), _dbContext);

        var ordered = query.Verdict == ReviewVerdict.Reviewed
            ? participations.OrderByDescending(p => p.ValidatedOn).ThenByDescending(p => p.Id)
            : participations.OrderByDescending(p => p.EndedOn).ThenByDescending(p => p.Id);
        var totalCount = await ordered.CountAsync(ct);
        var items = await ordered
            .Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .ToSummaries(_dbContext)
            .ToListAsync(ct);

        return new PagedResponse<ParticipationSummaryDto>(items, query.Page, query.PageSize, totalCount);
    }
}
