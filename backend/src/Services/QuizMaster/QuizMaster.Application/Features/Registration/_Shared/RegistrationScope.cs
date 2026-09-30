namespace QuizMaster.Application.Features.Registration.Shared;

// Reads for a person who is registering and therefore has no tenant yet: the key is how their organization is found.
//insight - the second of the two places allowed to use IgnoreQueryFilters() (the other is UserClaimsTransformation),
// for the same reason: discovering the tenant is the job. Every read AFTER the key is pinned to the key's tenant
// explicitly, so a registration can reach nothing outside the organization that issued the key.
public class RegistrationScope(QuizMasterDbContext _dbContext)
{
    // Tracked: registration claims the key or spends one of its child slots.
    public async Task<RegistrationKey> FindKeyAsync(string code, CancellationToken ct)
        => await _dbContext.RegistrationKeys.IgnoreQueryFilters()
               .SingleOrDefaultAsync(key => key.Code == code.Trim(), ct)
           ?? throw new BadRequestException("Registration key not found.");

    public async Task<ClassGroup> FindClassAsync(RegistrationKey key, int classId, CancellationToken ct)
        => await _dbContext.Classes.IgnoreQueryFilters().AsNoTracking()
               .SingleOrDefaultAsync(classGroup => classGroup.Id == classId && classGroup.TenantId == key.TenantId, ct)
           ?? throw new BadRequestException($"ClassGroup {classId} does not exist.");

    public async Task<User> FindKeyOwnerAsync(RegistrationKey key, CancellationToken ct)
        => key.ParentId is { } parentId
            ? await _dbContext.Users.IgnoreQueryFilters()
                  .SingleAsync(user => user.Id == parentId && user.TenantId == key.TenantId, ct)
            : throw new BadRequestException("This registration key has not been claimed by a parent yet.");

    public async Task<bool> TenantIsActiveAsync(RegistrationKey key, CancellationToken ct)
        => await _dbContext.Tenants.AnyAsync(tenant => tenant.Id == key.TenantId && tenant.IsActive, ct);

    public void Add(User user) => _dbContext.Users.Add(user);

    public Task SaveChangesAsync(CancellationToken ct) => _dbContext.SaveChangesAsync(ct);

    // Parent registration saves twice (the key is claimed by the new user's id), and both saves must stand or fall together.
    public Task<T> InTransactionAsync<T>(Func<Task<T>> work, CancellationToken ct) => _dbContext.InTransactionAsync(work, ct);
}
