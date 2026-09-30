using Microsoft.EntityFrameworkCore;
using QuizMaster.Persistence;

namespace QuizMaster.API;

// DEVELOPMENT ONLY: gives every seeded account ("dev-admin", …) that has no password yet the one below, so the Angular
// app can sign in as them with their seeded email. An account whose password was already set is left alone.
public static class DevelopmentSignIns
{
    public const string Password = "password";

    public static async Task EnsureAsync(IServiceProvider services, ILogger logger, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<QuizMasterDbContext>();
        var accounts = scope.ServiceProvider.GetRequiredService<ISignInAccounts>();

        var withPassword = db.SignInCredentials.Where(credential => credential.PasswordHash != null).Select(credential => credential.Uid);
        var seeded = await db.Users.IgnoreQueryFilters()
            .Where(user => user.SignInUid.StartsWith("dev-") && !withPassword.Contains(user.SignInUid))
            .Select(user => new { user.SignInUid, user.Email })
            .ToListAsync(ct);

        foreach (var user in seeded)
            await accounts.SetPasswordAsync(user.SignInUid, user.Email, Password, ct);

        if (seeded.Count > 0)
            logger.LogInformation("Development: {Count} seeded accounts can sign in with password '{Password}' ({Emails})",
                seeded.Count, Password, string.Join(", ", seeded.Select(user => user.Email)));
    }
}
