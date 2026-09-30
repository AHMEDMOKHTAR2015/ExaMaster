using System.Reflection;
using Blocks.Core.Security;
using Blocks.Exceptions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Microsoft.Extensions.Caching.Memory;

namespace QuizMaster.Persistence;

public class QuizMasterDbContext(DbContextOptions<QuizMasterDbContext> options, IMemoryCache cache, ITenantProvider tenantProvider)
    : ApplicationDbContext<QuizMasterDbContext>(options, cache)
{
    #region Entities
    public virtual DbSet<Tenant> Tenants { get; set; }
    public virtual DbSet<User> Users { get; set; }
    public virtual DbSet<Stage> Stages { get; set; }
    public virtual DbSet<Grade> Grades { get; set; }
    public virtual DbSet<ClassGroup> Classes { get; set; }
    public virtual DbSet<Subject> Subjects { get; set; }
    public virtual DbSet<Teacher> Teachers { get; set; }
    public virtual DbSet<Question> Questions { get; set; }
    public virtual DbSet<BankQuiz> BankQuizzes { get; set; }
    public virtual DbSet<TeacherQuiz> TeacherQuizzes { get; set; }
    public virtual DbSet<HomeworkAssignment> Assignments { get; set; }
    public virtual DbSet<Participation> Participations { get; set; }
    public virtual DbSet<QuizAttemptLock> AttemptLocks { get; set; }
    public virtual DbSet<RegistrationKey> RegistrationKeys { get; set; }
    public virtual DbSet<Notification> Notifications { get; set; }
    public virtual DbSet<TranslationOverride> TranslationOverrides { get; set; }
    public virtual DbSet<Accounts.SignInCredential> SignInCredentials { get; set; }   // platform-wide: no tenant filter
    public virtual DbSet<Accounts.RefreshToken> RefreshTokens { get; set; }
    #endregion

    //insight - tenant isolation is structural, not remembered: every tenant-owned table carries a global query filter on
    // this value, so a query that forgets a WHERE cannot leak another organization's data. 0 = no tenant = sees nothing.
    // EF evaluates it per query, so it follows the caller of the current request.
    public int CurrentTenantId => tenantProvider.TryGetTenantId() ?? 0;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Small immutable records stored as JSON columns (see HasJsonConversion): values, never tables.
        modelBuilder.Ignore<QuestionOption>();
        modelBuilder.Ignore<CompleteSegment>();
        modelBuilder.Ignore<GradedBlank>();

        modelBuilder.ApplyConfigurationsFromAssembly(GetType().Assembly);

        // table = singular CLR type name, PascalCase (SQL Server convention)
        modelBuilder.UseEntityTypeNamesAsTables();

        ApplyTenantIsolation(modelBuilder);
    }

    // datetime2 stores no time zone. Every DateTime here is UTC, so it is read back as UTC (serialized with a "Z").
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        base.ConfigureConventions(configurationBuilder);

        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
    }

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        this.UnTrackCacheableEntities();
        StampTenant();

        try
        {
            return await SaveClearingReferencesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("The record was changed by someone else. Reload it and try again.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: UniqueIndexViolation or UniqueConstraintViolation })
        {
            throw new ConflictException("That record already exists.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: ForeignKeyViolation })
        {
            throw new ConflictException("That record is still used by other records.");
        }
    }

    public override int SaveChanges()
    {
        StampTenant();
        return base.SaveChanges();
    }

    // For the few use cases that must save twice (a row that needs another's generated id) and keep both or neither.
    public async Task<T> InTransactionAsync<T>(Func<Task<T>> work, CancellationToken ct)
    {
        await using var transaction = await Database.BeginTransactionAsync(ct);
        var result = await work();
        await transaction.CommitAsync(ct);
        return result;
    }

    private const int UniqueIndexViolation = 2601;
    private const int UniqueConstraintViolation = 2627;
    private const int ForeignKeyViolation = 547;

    //insight - SQL Server refuses a table reachable by two ON DELETE paths (Stage → BankQuiz → Participation and
    // Stage → Question → BankQuizQuestion would both be). So the optional links from quizzes, questions and assignments
    // to reference data are NO ACTION in the database and cleared here, in the delete's own transaction, exactly
    // as ON DELETE SET NULL would. The tenant filter scopes each update to the caller's tenant.
    private async Task<int> SaveClearingReferencesAsync(CancellationToken ct)
    {
        var deleted = ChangeTracker.Entries()
            .Where(entry => entry.State == EntityState.Deleted && entry.Entity is Subject or Stage or Grade or ClassGroup)
            .Select(entry => entry.Entity)
            .ToList();

        if (deleted.Count == 0)
            return await base.SaveChangesAsync(ct);

        await using var transaction = Database.CurrentTransaction is null ? await Database.BeginTransactionAsync(ct) : null;

        foreach (var entity in deleted)
            await ClearReferencesToAsync(entity, ct);

        var saved = await base.SaveChangesAsync(ct);
        if (transaction is not null)
            await transaction.CommitAsync(ct);
        return saved;
    }

    private async Task ClearReferencesToAsync(object deleted, CancellationToken ct)
    {
        switch (deleted)
        {
            case Subject subject:
                await BankQuizzes.Where(e => e.SubjectId == subject.Id).ExecuteUpdateAsync(set => set.SetProperty(e => e.SubjectId, (int?)null), ct);
                await Questions.Where(e => e.SubjectId == subject.Id).ExecuteUpdateAsync(set => set.SetProperty(e => e.SubjectId, (int?)null), ct);
                await Assignments.Where(e => e.SubjectId == subject.Id).ExecuteUpdateAsync(set => set.SetProperty(e => e.SubjectId, (int?)null), ct);
                break;
            case Stage stage:
                await BankQuizzes.Where(e => e.StageId == stage.Id).ExecuteUpdateAsync(set => set.SetProperty(e => e.StageId, (int?)null), ct);
                await Questions.Where(e => e.StageId == stage.Id).ExecuteUpdateAsync(set => set.SetProperty(e => e.StageId, (int?)null), ct);
                await TeacherQuizzes.Where(e => e.StageId == stage.Id).ExecuteUpdateAsync(set => set.SetProperty(e => e.StageId, (int?)null), ct);
                break;
            case Grade grade:
                await BankQuizzes.Where(e => e.GradeId == grade.Id).ExecuteUpdateAsync(set => set.SetProperty(e => e.GradeId, (int?)null), ct);
                await Questions.Where(e => e.GradeId == grade.Id).ExecuteUpdateAsync(set => set.SetProperty(e => e.GradeId, (int?)null), ct);
                await Assignments.Where(e => e.GradeId == grade.Id).ExecuteUpdateAsync(set => set.SetProperty(e => e.GradeId, (int?)null), ct);
                break;
            case ClassGroup classGroup:
                await BankQuizzes.Where(e => e.ClassId == classGroup.Id).ExecuteUpdateAsync(set => set.SetProperty(e => e.ClassId, (int?)null), ct);
                break;
        }
    }

    // New tenant-owned rows land in the caller's tenant; no row may ever move between tenants.
    // Outside a request (seeding) there is no caller tenant, and rows must name their tenant explicitly.
    // A platform administrator is the only row with no tenant at all.
    private void StampTenant()
    {
        var tenantId = CurrentTenantId;

        foreach (var entry in ChangeTracker.Entries<IMultitenancy>())
        {
            if (entry.State == EntityState.Added)
            {
                //insight - the one row that legitimately has no tenant: the vendor's platform administrator. User.Create
                // already ties PLATFORM_ADMIN to TenantId 0 (and AssignRoles never grants it), so this cannot be reached
                // by a tenant's account; stamping it would instead make the vendor a member of the caller's school
                if (entry.Entity is User { TenantId: 0 } user && user.Roles.Contains(UserRoleType.PLATFORM_ADMIN))
                    continue;

                if (entry.Entity.TenantId == 0)
                    entry.Entity.TenantId = tenantId != 0
                        ? tenantId
                        : throw new InvalidOperationException($"Cannot create a {entry.Entity.GetType().Name} without a tenant.");
                else if (tenantId != 0 && entry.Entity.TenantId != tenantId)
                    throw new InvalidOperationException($"Cannot create a {entry.Entity.GetType().Name} in another tenant.");
            }
            else if (entry.State == EntityState.Modified && entry.Property(e => e.TenantId).IsModified)
            {
                throw new InvalidOperationException($"A {entry.Entity.GetType().Name} cannot move to another tenant.");
            }
        }
    }

    private void ApplyTenantIsolation(ModelBuilder modelBuilder)
    {
        var applyTenantFilter = GetType().GetMethod(nameof(ApplyTenantFilter), BindingFlags.NonPublic | BindingFlags.Instance)!;

        foreach (var entityType in modelBuilder.Model.GetEntityTypes().Where(type => typeof(IMultitenancy).IsAssignableFrom(type.ClrType)).ToList())
            applyTenantFilter.MakeGenericMethod(entityType.ClrType).Invoke(this, [modelBuilder]);
    }

    private void ApplyTenantFilter<TEntity>(ModelBuilder modelBuilder)
        where TEntity : class, IMultitenancy
        => modelBuilder.Entity<TEntity>().HasQueryFilter(entity => entity.TenantId == CurrentTenantId);
}

// Marks values read from datetime2 as UTC; they were written as UTC.
internal sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
    value => value,
    value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
