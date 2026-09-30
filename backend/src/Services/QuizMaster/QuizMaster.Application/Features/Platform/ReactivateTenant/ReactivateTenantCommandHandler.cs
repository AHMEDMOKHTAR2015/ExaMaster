namespace QuizMaster.Application.Features.Platform.ReactivateTenant;

public class ReactivateTenantCommandHandler(Repository<Tenant> _tenantRepository) : IRequestHandler<ReactivateTenantCommand, IdResponse>
{
    public async Task<IdResponse> Handle(ReactivateTenantCommand command, CancellationToken ct)
    {
        var tenant = await _tenantRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        tenant.Reactivate(command);
        await _tenantRepository.SaveChangesAsync(ct);

        return new IdResponse(tenant.Id);
    }
}
