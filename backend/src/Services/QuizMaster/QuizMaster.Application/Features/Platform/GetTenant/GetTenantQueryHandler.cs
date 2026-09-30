namespace QuizMaster.Application.Features.Platform.GetTenant;

public class GetTenantQueryHandler(Repository<Tenant> _tenantRepository) : IRequestHandler<GetTenantQuery, TenantDto>
{
    public async Task<TenantDto> Handle(GetTenantQuery query, CancellationToken ct)
        => (await _tenantRepository.GetByIdOrThrowAsync(query.Id, ct)).Adapt<TenantDto>();
}
