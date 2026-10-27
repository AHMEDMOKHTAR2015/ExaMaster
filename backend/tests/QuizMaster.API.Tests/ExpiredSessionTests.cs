using Blocks.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using QuizMaster.Application.SignIn;
using QuizMaster.Persistence;
using QuizMaster.Persistence.Accounts;
using QuizMasterPro.Security;

namespace QuizMaster.API.Tests;

// Expired sessions are forgotten, by the account's own next sign-in or renewal and by the startup sweep, and nothing a
// session still needs is: an unexpired revoked token stays, so presenting it again still ends every session of the account.
// Shares the teaching-room tests' SQL Server container; every test uses accounts of its own.
[Collection(TeachingRoomCollection.Name)]
public class ExpiredSessionTests(TeachingRoomApi api)
{
    private static readonly DateTime Now = DateTime.UtcNow;

    [Fact]
    public async Task Renewing_a_session_forgets_that_accounts_expired_sessions_and_keeps_what_theft_detection_needs()
    {
        var (uid, other) = (NewUid(), NewUid());
        var (current, spent) = (RefreshTokens.New(), RefreshTokens.New());
        await SeedAsync(
            Token(uid, current, expiresOn: Now.AddDays(10)),
            Token(uid, spent, expiresOn: Now.AddDays(10), revokedOn: Now.AddDays(-1), replacedBy: current),   // rotated earlier, not yet expired
            Token(uid, RefreshTokens.New(), expiresOn: Now.AddDays(-1)),                                      // expired, never revoked
            Token(uid, RefreshTokens.New(), expiresOn: Now.AddDays(-2), revokedOn: Now.AddDays(-20)),         // expired and revoked
            Token(other, RefreshTokens.New(), expiresOn: Now.AddDays(-1)));                                   // another account's

        await UseSessionsAsync(sessions => sessions.RefreshAsync(current, default));

        Assert.Equal(3, await CountAsync(uid));               // the renewed one (now spent), the spent one, the new session
        Assert.Equal(0, await CountAsync(uid, expired: true));
        Assert.Equal(1, await CountAsync(other));              // only its own sign-in, or the sweep, forgets another account's

        // the spent token presented again is still caught: every session of the account ends
        await Assert.ThrowsAsync<UnauthorizedException>(() => UseSessionsAsync(sessions => sessions.RefreshAsync(spent, default)));
        Assert.Equal(0, await CountAsync(uid, active: true));
    }

    [Fact]
    public async Task The_startup_sweep_forgets_every_accounts_expired_sessions_and_nothing_else()
    {
        var (first, second) = (NewUid(), NewUid());
        await SeedAsync(
            Token(first, RefreshTokens.New(), expiresOn: Now.AddDays(-1)),
            Token(first, RefreshTokens.New(), expiresOn: Now.AddDays(5)),
            Token(second, RefreshTokens.New(), expiresOn: Now.AddDays(-3), revokedOn: Now.AddDays(-10)),
            Token(second, RefreshTokens.New(), expiresOn: Now.AddDays(5), revokedOn: Now.AddDays(-1)));

        var forgotten = await UseSessionsAsync(sessions => sessions.ForgetEveryExpiredSessionAsync());

        Assert.True(forgotten >= 2);                           // other tests' expired sessions may be swept too
        Assert.Equal(1, await CountAsync(first));
        Assert.Equal(1, await CountAsync(second));
        Assert.Equal(0, await CountAsync(first, expired: true) + await CountAsync(second, expired: true));
    }

    private static string NewUid() => $"session-{Guid.NewGuid():N}";

    private static RefreshToken Token(string uid, string token, DateTime expiresOn, DateTime? revokedOn = null, string? replacedBy = null) => new()
    {
        Uid = uid,
        TokenHash = RefreshTokens.Hash(token),
        CreatedOn = expiresOn.AddDays(-30),
        ExpiresOn = expiresOn,
        RevokedOn = revokedOn,
        ReplacedByHash = replacedBy is null ? null : RefreshTokens.Hash(replacedBy)
    };

    private async Task SeedAsync(params RefreshToken[] tokens)
    {
        using var scope = api.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<QuizMasterDbContext>();
        db.RefreshTokens.AddRange(tokens);
        await db.SaveChangesAsync();
    }

    private async Task<T> UseSessionsAsync<T>(Func<SignInSessions, Task<T>> use)
    {
        using var scope = api.Services.CreateScope();
        return await use(scope.ServiceProvider.GetRequiredService<SignInSessions>());
    }

    private async Task<int> CountAsync(string uid, bool expired = false, bool active = false)
    {
        using var scope = api.Services.CreateScope();
        var tokens = scope.ServiceProvider.GetRequiredService<QuizMasterDbContext>().RefreshTokens.Where(t => t.Uid == uid);
        if (expired)
            tokens = tokens.Where(t => t.ExpiresOn <= Now);
        if (active)
            tokens = tokens.Where(t => t.RevokedOn == null && t.ExpiresOn > DateTime.UtcNow);
        return await tokens.CountAsync();
    }
}
