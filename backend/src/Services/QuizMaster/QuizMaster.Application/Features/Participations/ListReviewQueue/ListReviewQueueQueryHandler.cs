using QuizMaster.Application.Features.Participations.Shared;

namespace QuizMaster.Application.Features.Participations.ListReviewQueue;

public class ListReviewQueueQueryHandler(QuizMasterDbContext _dbContext, IClaimsProvider _claimsProvider)
    : IRequestHandler<ListReviewQueueQuery, PagedResponse<ParticipationSummaryDto>>
{
    public async Task<PagedResponse<ParticipationSummaryDto>> Handle(ListReviewQueueQuery query, CancellationToken ct)
    {
        var caller = Caller.From(_claimsProvider);

        // A teacher's queue is their own: how much a colleague has outstanding is not theirs to read.
        var reviewerId = caller.IsApplicationAdmin ? query.ReviewerId : caller.UserId;

        var queue = _dbContext.Participations.AsNoTracking().AwaitingReview();
        if (reviewerId is { } id)
            queue = queue.Where(participation => participation.ReviewerId == id);

        var ordered = queue.OrderBy(participation => participation.EndedOn).ThenBy(participation => participation.Id);   // oldest first
        var totalCount = await ordered.CountAsync(ct);
        var items = await ordered
            .Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .ToSummaries(_dbContext)
            .ToListAsync(ct);

        return new PagedResponse<ParticipationSummaryDto>(items, query.Page, query.PageSize, totalCount);
    }
}
