namespace QuizMasterPro.Security;

// The credential a person signs in with: an email (a family's is built from their mobile number) and a password.
// Kept apart from the profile (User), which decides what they may do. Implemented over the service's own database.
public interface ISignInAccounts
{
    // Returns the new account's uid. Throws ConflictException when the email is already registered: sign-in is one pool
    // across every organization, so it may belong to someone at another school.
    Task<string> CreateAsync(NewSignInAccount account, CancellationToken ct);

    Task<string?> FindUidByEmailAsync(string email, CancellationToken ct);

    // Sets (or replaces) the password of an existing account, creating its credential if it never had one (an account
    // brought over from the old system). Signs every existing session of that account out.
    Task SetPasswordAsync(string uid, string email, string password, CancellationToken ct);

    Task DeleteAsync(string uid, CancellationToken ct);
}

public sealed record NewSignInAccount(string Email, string Password, string DisplayName);

public static class SignInAccountsExtensions
{
    //insight - the credential is created first, because its uid is part of the profile; if the profile then fails to
    // save, the credential is removed again so no orphaned login is left that belongs to nobody.
    public static async Task<TResult> CreateThenPersistAsync<TResult>(
        this ISignInAccounts accounts, NewSignInAccount account, Func<string, Task<TResult>> persist, CancellationToken ct)
    {
        var uid = await accounts.CreateAsync(account, ct);
        try
        {
            return await persist(uid);
        }
        catch
        {
            try { await accounts.DeleteAsync(uid, CancellationToken.None); }
            catch { /* the original failure is the one worth reporting */ }
            throw;
        }
    }
}
