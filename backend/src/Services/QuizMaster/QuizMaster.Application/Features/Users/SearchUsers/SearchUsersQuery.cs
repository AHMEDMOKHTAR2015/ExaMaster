using QuizMaster.Application.Features.Users.Shared;

namespace QuizMaster.Application.Features.Users.SearchUsers;

// Staff browse their own organization's accounts (the tenant filter keeps it to theirs).
public record SearchUsersQuery(
    UserRoleType? Role = null,
    int? ClassId = null,
    int? ParentId = null,
    string? Search = null,
    bool? IsActive = null,
    UserActivity? Activity = null,             // the Users table's status filter (UserFilters.WithActivity)
    bool Participated = false,                  // only accounts with a submitted attempt, most attempts first
    int Page = 1,
    int PageSize = Paging.DefaultPageSize) : IQuery<PagedResponse<UserDto>>, IPagedQuery;

public class SearchUsersQueryValidator : AbstractValidator<SearchUsersQuery>
{
    public SearchUsersQueryValidator()
    {
        this.AddPagingRules();
        RuleFor(q => q.Search).MaximumLengthWithMessage(MaxLength.C128, nameof(SearchUsersQuery.Search));
        RuleFor(q => q.Activity).IsInEnum();
    }
}
