namespace QuizMaster.Application.Features.RegistrationKeys.SearchRegistrationKeys;

// The organization's keys, newest first, optionally narrowed to one role, one status, or a code containing Search.
public record SearchRegistrationKeysQuery(
    RegistrationKeyStatus? Status = null,
    UserRoleType? Role = null,
    string? Search = null,
    int Page = 1,
    int PageSize = Paging.DefaultPageSize) : IQuery<PagedResponse<RegistrationKeyDto>>, IPagedQuery;

public class SearchRegistrationKeysQueryValidator : AbstractValidator<SearchRegistrationKeysQuery>
{
    public SearchRegistrationKeysQueryValidator()
    {
        this.AddPagingRules();
        RuleFor(q => q.Status).IsInEnum();
        RuleFor(q => q.Role).IsInEnum();
        RuleFor(q => q.Search).MaximumLengthWithMessage(MaxLength.C128, nameof(SearchRegistrationKeysQuery.Search));
    }
}
