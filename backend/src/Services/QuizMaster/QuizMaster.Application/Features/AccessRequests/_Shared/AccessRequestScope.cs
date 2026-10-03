using QuizMaster.Application.Features.Users.Shared;

namespace QuizMaster.Application.Features.AccessRequests.Shared;

// Reads and writes inside the organization a platform administrator chose while approving an access request.
//insight - the platform administrator has no tenant (their CurrentTenantId is 0, which matches no school's rows), so
// these reads cross the query filter on purpose, like RegistrationScope does for a visitor holding a key. Every read
// names the chosen tenant explicitly, so an approval can reach nothing outside the organization it was approved into,
// and it reads only what placing one account needs: classes, and the parents a child can be linked to.
public class AccessRequestScope(QuizMasterDbContext _dbContext)
{
    public async Task<Tenant> FindActiveTenantAsync(int tenantId, CancellationToken ct)
    {
        var tenant = await _dbContext.Tenants.SingleOrDefaultAsync(tenant => tenant.Id == tenantId, ct)
            ?? throw new BadRequestException($"Organization {tenantId} does not exist.");
        return tenant.IsActive
            ? tenant
            : throw new BadRequestException($"{tenant.Name} is suspended. Reactivate it before adding people to it.");
    }

    public async Task<ClassGroup> FindClassAsync(int tenantId, int classId, CancellationToken ct)
        => await _dbContext.Classes.IgnoreQueryFilters().AsNoTracking()
               .SingleOrDefaultAsync(classGroup => classGroup.Id == classId && classGroup.TenantId == tenantId, ct)
           ?? throw new BadRequestException("That class is not part of the chosen organization.");

    // Tracked, with their key: approving a child spends one of that family's slots.
    public async Task<(User Parent, RegistrationKey Key)> FindParentWithKeyAsync(int tenantId, int parentId, CancellationToken ct)
    {
        var parent = await _dbContext.Users.IgnoreQueryFilters()
                         .SingleOrDefaultAsync(user => user.Id == parentId && user.TenantId == tenantId, ct)
                     ?? throw new BadRequestException("That parent is not part of the chosen organization.");
        if (!parent.IsParent)
            throw new BadRequestException($"{parent.DisplayName} is not a parent account.");

        var key = parent.RegistrationKeyId is { } keyId
            ? await _dbContext.RegistrationKeys.IgnoreQueryFilters().SingleAsync(key => key.Id == keyId && key.TenantId == tenantId, ct)
            : throw new BadRequestException($"{parent.DisplayName} has no registration key, so there is no family subscription to add the child to.");
        return (parent, key);
    }

    public async Task<IReadOnlyList<TenantClassOptionDto>> ListClassesAsync(int tenantId, CancellationToken ct)
        => await (from classGroup in _dbContext.Classes.IgnoreQueryFilters()
                  join grade in _dbContext.Grades.IgnoreQueryFilters() on classGroup.GradeId equals grade.Id
                  join stage in _dbContext.Stages.IgnoreQueryFilters() on classGroup.StageId equals stage.Id
                  where classGroup.TenantId == tenantId
                  orderby stage.Order, stage.Name, grade.Order, grade.Name, classGroup.Name
                  select new TenantClassOptionDto(classGroup.Id, classGroup.Name, grade.Id, grade.Name, stage.Id, stage.Name))
            .AsNoTracking().ToListAsync(ct);

    public async Task<IReadOnlyList<TenantParentOptionDto>> SearchParentsAsync(int tenantId, string? search, int limit, DateTime now, CancellationToken ct)
    {
        var parents = _dbContext.Users.IgnoreQueryFilters()
            .Where(user => user.TenantId == tenantId && user.Roles.Contains(UserRoleType.PARENT));

        var found = await parents.MatchingSearch(search).OrderBy(user => user.DisplayName).ThenBy(user => user.Id).Take(limit)
            .Select(user => new { user.Id, user.DisplayName, user.MobileNumber, user.RegistrationKeyId })
            .ToListAsync(ct);

        var keyIds = found.Where(parent => parent.RegistrationKeyId != null).Select(parent => parent.RegistrationKeyId!.Value).ToList();
        var keys = await _dbContext.RegistrationKeys.IgnoreQueryFilters().AsNoTracking()
            .Where(key => key.TenantId == tenantId && keyIds.Contains(key.Id))
            .ToDictionaryAsync(key => key.Id, ct);

        return found.Select(parent =>
        {
            var key = parent.RegistrationKeyId is { } keyId ? keys.GetValueOrDefault(keyId) : null;
            return new TenantParentOptionDto(parent.Id, parent.DisplayName, parent.MobileNumber,
                key?.ChildCount ?? 0, key?.MaxChildren, key is not null && key.AdmissionProblemAt(now) is null);
        }).ToList();
    }

    public void Add(User user) => _dbContext.Users.Add(user);

    public void Add(RegistrationKey key) => _dbContext.RegistrationKeys.Add(key);

    public Task SaveChangesAsync(CancellationToken ct) => _dbContext.SaveChangesAsync(ct);

    public Task<T> InTransactionAsync<T>(Func<Task<T>> work, CancellationToken ct) => _dbContext.InTransactionAsync(work, ct);
}
