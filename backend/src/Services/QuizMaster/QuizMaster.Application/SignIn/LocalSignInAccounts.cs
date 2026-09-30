using Microsoft.AspNetCore.Identity;
using QuizMaster.Persistence.Accounts;

namespace QuizMaster.Application.SignIn;

// Credentials in this service's own database: an email and a PasswordHasher hash per account.
public class LocalSignInAccounts(QuizMasterDbContext _dbContext, IPasswordHasher<SignInCredential> _hasher) : ISignInAccounts
{
    public async Task<string> CreateAsync(NewSignInAccount account, CancellationToken ct)
    {
        var email = SignInCredential.Normalize(account.Email);
        if (await FindUidByEmailAsync(email, ct) is not null)
            throw new ConflictException("An account with this email or mobile number already exists.");

        var credential = new SignInCredential { Uid = $"u-{Guid.NewGuid():N}", Email = email, CreatedOn = DateTime.UtcNow };
        credential.PasswordHash = _hasher.HashPassword(credential, account.Password);
        credential.PasswordChangedOn = credential.CreatedOn;
        _dbContext.SignInCredentials.Add(credential);
        await _dbContext.SaveChangesAsync(ct);
        return credential.Uid;
    }

    // An email is taken by a credential, or by a profile brought over from the old system that has no credential yet.
    public async Task<string?> FindUidByEmailAsync(string email, CancellationToken ct)
    {
        var normalized = SignInCredential.Normalize(email);
        return await _dbContext.SignInCredentials.AsNoTracking().Where(c => c.Email == normalized).Select(c => c.Uid).FirstOrDefaultAsync(ct)
            ?? await _dbContext.Users.IgnoreQueryFilters().AsNoTracking().Where(u => u.Email == normalized).Select(u => u.SignInUid).FirstOrDefaultAsync(ct);
    }

    public async Task SetPasswordAsync(string uid, string email, string password, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var credential = await _dbContext.SignInCredentials.FirstOrDefaultAsync(c => c.Uid == uid, ct);
        if (credential is null)
        {
            var normalized = SignInCredential.Normalize(email);
            if (await _dbContext.SignInCredentials.AnyAsync(c => c.Email == normalized, ct))
                throw new ConflictException("Another account already signs in with this email or mobile number.");
            credential = new SignInCredential { Uid = uid, Email = normalized, CreatedOn = now };
            _dbContext.SignInCredentials.Add(credential);
        }

        credential.PasswordHash = _hasher.HashPassword(credential, password);
        credential.PasswordChangedOn = now;
        credential.RecordSuccess();                                  // a new password lifts a lockout

        await _dbContext.RefreshTokens.Where(t => t.Uid == uid && t.RevokedOn == null)
            .ExecuteUpdateAsync(set => set.SetProperty(t => t.RevokedOn, now), ct);
        await _dbContext.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(string uid, CancellationToken ct)
    {
        await _dbContext.RefreshTokens.Where(t => t.Uid == uid).ExecuteDeleteAsync(ct);
        await _dbContext.SignInCredentials.Where(c => c.Uid == uid).ExecuteDeleteAsync(ct);
    }
}
