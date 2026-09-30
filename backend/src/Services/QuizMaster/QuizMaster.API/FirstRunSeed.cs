using Microsoft.EntityFrameworkCore;
using QuizMaster.Domain.Shared;
using QuizMaster.Domain.Shared.Enums;
using QuizMaster.Domain.Users;
using QuizMaster.Persistence;
using QuizMasterPro.Abstractions.Enums;

namespace QuizMaster.API;

// What an empty database is given on first start. Only the vendor's platform administrator: the one account that can then
// create schools (each with its own first administrator, from the platform console). No school, user, quiz, homework or
// participation is seeded — the demo school is opt-in, Development only (SeedOptions).
public record PlatformAdministratorOptions
{
    public string Email { get; init; } = "platform@quizmasterpro.local";
    public string DisplayName { get; init; } = "Platform Administrator";

    // Set in appsettings.Development.json only. Anywhere else it must come from the environment or a secret store
    // (PlatformAdministratorOptions__Password): a password written into shipped settings would open every deployment.
    public string? Password { get; init; }
}

public record SeedOptions
{
    // Development only: the demo school (tenant "demo-school", one account per role with password "password", a
    // class, questions, quizzes, a homework). The smoke suite runs against it; nothing else needs it.
    public bool DemoSchool { get; init; }
}

public static class FirstRunSeed
{
    public const string PlatformAdministratorUid = "platform-admin";

    //insight - "first run" is decided by the data, not a flag: while no platform administrator exists (a user in no
    // organization, TenantId 0), one is created. So it happens exactly once per database, survives restarts, and an
    // already-seeded platform administrator stops it.
    public static async Task EnsurePlatformAdministratorAsync(IServiceProvider services, IConfiguration configuration, ILogger logger,
        CancellationToken ct = default)
    {
        var options = configuration.GetSection(nameof(PlatformAdministratorOptions)).Get<PlatformAdministratorOptions>() ?? new();

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<QuizMasterDbContext>();
        if (await db.Users.IgnoreQueryFilters().AnyAsync(user => user.TenantId == 0, ct))
            return;

        if (string.IsNullOrWhiteSpace(options.Password))
        {
            logger.LogWarning("First run: no platform administrator exists and none was created. Set " +
                "PlatformAdministratorOptions__Password (and optionally __Email) and restart to create one.");
            return;
        }

        var system = new SystemAction(QuizMasterActionType.Seed, DateTime.UtcNow);
        db.Users.Add(User.Create(0, PlatformAdministratorUid, options.Email, options.DisplayName, [UserRoleType.PLATFORM_ADMIN], system));
        await db.SaveChangesAsync(ct);

        var accounts = scope.ServiceProvider.GetRequiredService<ISignInAccounts>();
        await accounts.SetPasswordAsync(PlatformAdministratorUid, options.Email, options.Password, ct);

        logger.LogInformation("First run: created the platform administrator {Email}. Sign in and change the password.", options.Email);
    }
}
