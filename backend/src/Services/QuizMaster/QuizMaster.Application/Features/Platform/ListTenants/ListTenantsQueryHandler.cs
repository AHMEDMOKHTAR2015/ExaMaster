namespace QuizMaster.Application.Features.Platform.ListTenants;

public class ListTenantsQueryHandler(Repository<Tenant> _tenantRepository)
    : IRequestHandler<ListTenantsQuery, PagedResponse<TenantDto>>
{
    public async Task<PagedResponse<TenantDto>> Handle(ListTenantsQuery query, CancellationToken ct)
    {
        var tenants = _tenantRepository.QueryNotTracked();

        if (query.IsActive is { } isActive)
            tenants = tenants.Where(tenant => tenant.IsActive == isActive);
        if (TextSearch.ContainsPattern(query.Search) is { } pattern)
            tenants = tenants.Where(tenant => EF.Functions.Like(tenant.Name, pattern, TextSearch.EscapeCharacter) || EF.Functions.Like(tenant.Slug, pattern, TextSearch.EscapeCharacter));

        return await tenants
            .OrderBy(tenant => tenant.Name).ThenBy(tenant => tenant.Id)
            .ToPageAsync(query, tenant => tenant.Adapt<TenantDto>(), ct);
    }
}
