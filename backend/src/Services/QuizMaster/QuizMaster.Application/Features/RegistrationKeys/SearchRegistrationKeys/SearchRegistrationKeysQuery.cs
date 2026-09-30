namespace QuizMaster.Application.Features.RegistrationKeys.SearchRegistrationKeys;

// The organization's keys, newest first, optionally narrowed to one role or one status.
public record SearchRegistrationKeysQuery(
    RegistrationKeyStatus? Status = null,
    UserRoleType? Role = null,
    int Page = 1,
    int PageSize = Paging.DefaultPageSize) : IQuery<PagedResponse<RegistrationKeyDto>>, IPagedQuery;

public class SearchRegistrationKeysQueryValidator : AbstractValidator<SearchRegistrationKeysQuery>
{
    public SearchRegistrationKeysQueryValidator()
    {
        this.AddPagingRules();
        RuleFor(q => q.Status).IsInEnum();
        RuleFor(q => q.Role).IsInEnum();
    }
}
