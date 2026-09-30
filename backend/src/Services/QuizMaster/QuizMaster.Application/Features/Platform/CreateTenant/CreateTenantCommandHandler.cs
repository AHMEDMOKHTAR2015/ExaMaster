using System.Buffers.Text;
using System.Security.Cryptography;

namespace QuizMaster.Application.Features.Platform.CreateTenant;

public class CreateTenantCommandHandler(
    QuizMasterDbContext _dbContext, Repository<Tenant> _tenantRepository, Repository<User> _userRepository, ISignInAccounts _signInAccounts)
    : IRequestHandler<CreateTenantCommand, CreateTenantResponse>
{
    public async Task<CreateTenantResponse> Handle(CreateTenantCommand command, CancellationToken ct)
    {
        var slug = command.Slug.Trim().ToLowerInvariant();
        var email = command.AdminEmail.Trim().ToLowerInvariant();

        // the id is permanent: reusing one would silently merge two customers
        if (await _tenantRepository.ExistsAsync(tenant => tenant.Slug == slug, ct))
            throw new ConflictException($"An organization with the id '{slug}' already exists.");

        //insight - sign-in is one pool across every customer, so an address already in use belongs to
        // somebody, possibly at another school. Adopting it would hand that person this organization's administration.
        if (await _signInAccounts.FindUidByEmailAsync(email, ct) is not null)
            throw new ConflictException($"{email} already has a login. Use a fresh address for this organization's administrator.");

        var generatedPassword = command.AdminPassword is null ? Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(12)) : null;
        var displayName = $"{command.Name.Trim()} Administrator";

        return await _signInAccounts.CreateThenPersistAsync(new NewSignInAccount(email, command.AdminPassword ?? generatedPassword!, displayName), async uid =>
            await _dbContext.InTransactionAsync(async () =>
            {
                var tenant = Tenant.Create(slug, command.Name, command.Plan, command);
                await _tenantRepository.AddAsync(tenant, ct);
                await _tenantRepository.SaveChangesAsync(ct);        // the administrator is created in it by id

                // the caller (the vendor) has no tenant, so the row names its organization explicitly
                var admin = User.Create(tenant.Id, uid, email, displayName, [UserRoleType.APPLICATION_ADMIN], command);
                await _userRepository.AddAsync(admin, ct);
                await _userRepository.SaveChangesAsync(ct);

                return new CreateTenantResponse(tenant.Id, tenant.Slug, admin.Id, email, generatedPassword);
            }, ct), ct);
    }
}
