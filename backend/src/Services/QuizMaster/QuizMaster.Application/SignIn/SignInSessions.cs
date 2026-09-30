using Microsoft.AspNetCore.Identity;
using QuizMaster.Persistence.Accounts;

namespace QuizMaster.Application.SignIn;

public record SessionTokens(string AccessToken, DateTime AccessTokenExpiresOn, string RefreshToken, DateTime RefreshTokenExpiresOn);

// Password sign-in and the sessions it opens.
public class SignInSessions(QuizMasterDbContext _dbContext, IPasswordHasher<SignInCredential> _hasher, AccessTokenIssuer _tokens)
{
    // One message for every way a sign-in can fail, so the answer never reveals which emails have accounts.
    public const string WrongCredentialsMessage = "The email or mobile number, or the password, is not correct.";
    public const string LockedOutMessage = "Too many attempts. Wait a few minutes, then try again.";

    public async Task<SessionTokens> SignInAsync(string email, string password, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var normalized = SignInCredential.Normalize(email);
        var credential = await _dbContext.SignInCredentials.FirstOrDefaultAsync(c => c.Email == normalized, ct);
        if (credential?.PasswordHash is null)
            throw new UnauthorizedException(WrongCredentialsMessage);
        if (credential.IsLockedOut(now))
            throw new UnauthorizedException(LockedOutMessage);

        var result = _hasher.VerifyHashedPassword(credential, credential.PasswordHash, password);
        if (result == PasswordVerificationResult.Failed)
        {
            credential.RecordFailure(now);
            await _dbContext.SaveChangesAsync(ct);
            throw new UnauthorizedException(credential.IsLockedOut(now) ? LockedOutMessage : WrongCredentialsMessage);
        }

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
            credential.PasswordHash = _hasher.HashPassword(credential, password);   // a stronger format than it was stored in
        credential.RecordSuccess();
        return await OpenSessionAsync(credential.Uid, now, ct);
    }

    //insight - rotation: every refresh spends the token and issues a new one. A token presented after it was spent can
    // only be a copy, so the whole family of that account's sessions is ended rather than just refusing the copy.
    public async Task<SessionTokens> RefreshAsync(string refreshToken, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var hash = RefreshTokens.Hash(refreshToken);
        var stored = await _dbContext.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct)
            ?? throw new UnauthorizedException("This session has ended. Sign in again.");

        if (stored.RevokedOn is not null && stored.ReplacedByHash is not null)
        {
            await RevokeAllAsync(stored.Uid, now, ct);
            throw new UnauthorizedException("This session has ended. Sign in again.");
        }
        if (!stored.IsActive(now))
            throw new UnauthorizedException("This session has ended. Sign in again.");

        var session = await OpenSessionAsync(stored.Uid, now, ct, save: false);
        stored.RevokedOn = now;
        stored.ReplacedByHash = RefreshTokens.Hash(session.RefreshToken);
        await _dbContext.SaveChangesAsync(ct);
        return session;
    }

    public async Task SignOutAsync(string refreshToken, CancellationToken ct)
    {
        var hash = RefreshTokens.Hash(refreshToken);
        await _dbContext.RefreshTokens.Where(t => t.TokenHash == hash && t.RevokedOn == null)
            .ExecuteUpdateAsync(set => set.SetProperty(t => t.RevokedOn, DateTime.UtcNow), ct);
    }

    public async Task<bool> VerifyPasswordAsync(string uid, string password, CancellationToken ct)
    {
        var credential = await _dbContext.SignInCredentials.AsNoTracking().FirstOrDefaultAsync(c => c.Uid == uid, ct);
        return credential?.PasswordHash is not null
            && _hasher.VerifyHashedPassword(credential, credential.PasswordHash, password) != PasswordVerificationResult.Failed;
    }

    // A sign-in and a renewal both open a session, so both mark the person active: someone who comes back on a
    // remembered session never signs in again, but does renew.
    private async Task<SessionTokens> OpenSessionAsync(string uid, DateTime now, CancellationToken ct, bool save = true)
    {
        await RecordActivityAsync(uid, now, ct);
        var access = _tokens.Issue(uid, now);
        var refresh = RefreshTokens.New();
        var refreshExpiresOn = _tokens.RefreshTokenExpiry(now);
        _dbContext.RefreshTokens.Add(new RefreshToken
        {
            Uid = uid, TokenHash = RefreshTokens.Hash(refresh), CreatedOn = now, ExpiresOn = refreshExpiresOn
        });
        if (save)
            await _dbContext.SaveChangesAsync(ct);
        return new SessionTokens(access.Token, access.ExpiresOn, refresh, refreshExpiresOn);
    }

    // Straight to the column: no audit stamp and no row loaded, so activity never reads as someone editing the account.
    // No tenant is known yet (the caller is anonymous), hence IgnoreQueryFilters; the uid names one account platform-wide.
    private Task RecordActivityAsync(string uid, DateTime now, CancellationToken ct)
        => _dbContext.Users.IgnoreQueryFilters().Where(u => u.SignInUid == uid)
            .ExecuteUpdateAsync(set => set.SetProperty(u => u.LastActiveOn, now), ct);

    private Task RevokeAllAsync(string uid, DateTime now, CancellationToken ct)
        => _dbContext.RefreshTokens.Where(t => t.Uid == uid && t.RevokedOn == null)
            .ExecuteUpdateAsync(set => set.SetProperty(t => t.RevokedOn, now), ct);
}
