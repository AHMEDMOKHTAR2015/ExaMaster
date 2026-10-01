using QuizMaster.Application.Features.AccessRequests.Shared;

namespace QuizMaster.Application.Features.AccessRequests.ListTenantClasses;

// The classes of one organization, for placing a child whose access request is being approved.
public record ListTenantClassesQuery(int TenantId) : IQuery<IReadOnlyList<TenantClassOptionDto>>;

public class ListTenantClassesQueryHandler(Repository<Tenant> _tenantRepository, AccessRequestScope _scope)
    : IRequestHandler<ListTenantClassesQuery, IReadOnlyList<TenantClassOptionDto>>
{
    public async Task<IReadOnlyList<TenantClassOptionDto>> Handle(ListTenantClassesQuery query, CancellationToken ct)
    {
        var tenant = await _tenantRepository.GetByIdOrThrowAsync(query.TenantId, ct);
        return await _scope.ListClassesAsync(tenant.Id, ct);
    }
}
