namespace QuizMaster.Application.Features.Registration.Shared;

public static class RegistrationGuards
{
    // Registration is for people without an account. It also keeps the tenant stamping honest: a signed-in caller has a
    // tenant, and a row created for another organization's key would be refused anyway (QuizMasterDbContext.StampTenant).
    public static void EnsureCallerHasNoAccount(IClaimsProvider claimsProvider)
    {
        if (claimsProvider.TryGetUserId() is not null)
            throw new BadRequestException("You are already signed in to an account. Sign out before registering a new one.");
    }

    // A suspended organization admits nobody; registering into it would only create an account that cannot sign in.
    public static async Task EnsureOrganizationIsActiveAsync(RegistrationScope scope, RegistrationKey key, CancellationToken ct)
    {
        if (!await scope.TenantIsActiveAsync(key, ct))
            throw new BadRequestException("This organization is not accepting registrations.");
    }
}
