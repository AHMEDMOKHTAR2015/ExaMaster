namespace QuizMaster.Application.Features.Platform.UpdateTenant;

public class UpdateTenantCommandHandler(Repository<Tenant> _tenantRepository) : IRequestHandler<UpdateTenantCommand, IdResponse>
{
    public async Task<IdResponse> Handle(UpdateTenantCommand command, CancellationToken ct)
    {
        var tenant = await _tenantRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        tenant.UpdateProfile(command.Name, command.Plan, command.LogoUrl, command.PrimaryColor, command);
        await _tenantRepository.SaveChangesAsync(ct);

        return new IdResponse(tenant.Id);
    }
}
