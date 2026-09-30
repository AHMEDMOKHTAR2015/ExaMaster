namespace QuizMaster.Application.Features.Platform.SuspendTenant;

public class SuspendTenantCommandHandler(Repository<Tenant> _tenantRepository) : IRequestHandler<SuspendTenantCommand, IdResponse>
{
    public async Task<IdResponse> Handle(SuspendTenantCommand command, CancellationToken ct)
    {
        var tenant = await _tenantRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        tenant.Suspend(command);
        await _tenantRepository.SaveChangesAsync(ct);

        return new IdResponse(tenant.Id);
    }
}
