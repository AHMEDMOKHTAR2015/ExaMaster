namespace QuizMaster.Application.Features.Participations.ListReviewQueue;

// A teacher's Validation queue: submissions they review that have no verdict yet or still have unmarked answers.
// Replaces the app's reviewQueues aggregate (a query now, not a trigger-maintained counter). Administrators may pass
// ReviewerId to look at a colleague's queue, or leave it empty for the whole organization's.
public record ListReviewQueueQuery(int? ReviewerId = null, int Page = 1, int PageSize = Paging.DefaultPageSize)
    : IQuery<PagedResponse<ParticipationSummaryDto>>, IPagedQuery;

public class ListReviewQueueQueryValidator : AbstractValidator<ListReviewQueueQuery>
{
    public ListReviewQueueQueryValidator() => this.AddPagingRules();
}
