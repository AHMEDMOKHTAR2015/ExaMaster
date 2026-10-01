using QuizMaster.Application.Features.AccessRequests.Shared;

namespace QuizMaster.Application.Features.AccessRequests.SearchTenantParents;

// The parents of one organization, for linking a child whose access request is being approved.
public record SearchTenantParentsQuery(int TenantId, string? Search = null) : IQuery<IReadOnlyList<TenantParentOptionDto>>;

public class SearchTenantParentsQueryValidator : AbstractValidator<SearchTenantParentsQuery>
{
    public SearchTenantParentsQueryValidator()
    {
        RuleFor(q => q.Search).MaximumLengthWithMessage(MaxLength.C128, nameof(SearchTenantParentsQuery.Search));
    }
}

public class SearchTenantParentsQueryHandler(Repository<Tenant> _tenantRepository, AccessRequestScope _scope)
    : IRequestHandler<SearchTenantParentsQuery, IReadOnlyList<TenantParentOptionDto>>
{
    // a picker, not a directory: the reviewer narrows by name or mobile number
    private const int Limit = 50;

    public async Task<IReadOnlyList<TenantParentOptionDto>> Handle(SearchTenantParentsQuery query, CancellationToken ct)
    {
        var tenant = await _tenantRepository.GetByIdOrThrowAsync(query.TenantId, ct);
        return await _scope.SearchParentsAsync(tenant.Id, query.Search, Limit, DateTime.UtcNow, ct);
    }
}
