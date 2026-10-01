namespace QuizMaster.Application.Features.AccessRequests.ListAccessRequests;

// The platform administrator's review queue, and its history.
public record ListAccessRequestsQuery(
    AccessRequestStatus? Status = null,
    AccessRequestKind? Kind = null,
    string? Search = null,
    int Page = 1,
    int PageSize = Paging.DefaultPageSize) : IQuery<PagedResponse<AccessRequestDto>>, IPagedQuery;

public class ListAccessRequestsQueryValidator : AbstractValidator<ListAccessRequestsQuery>
{
    public ListAccessRequestsQueryValidator()
    {
        this.AddPagingRules();
        RuleFor(q => q.Status).IsInEnum();
        RuleFor(q => q.Kind).IsInEnum();
        RuleFor(q => q.Search).MaximumLengthWithMessage(MaxLength.C128, nameof(ListAccessRequestsQuery.Search));
    }
}
