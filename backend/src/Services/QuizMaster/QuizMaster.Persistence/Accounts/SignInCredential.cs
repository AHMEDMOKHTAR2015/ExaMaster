namespace QuizMaster.Persistence.Accounts;

// How a person signs in: an email and a password hash. One pool across every organization (the email must identify one
// account before any tenant is known), so it carries no tenant and no tenant filter. The profile — roles, organization —
// is the User whose SignInUid equals Uid.
public class SignInCredential
{
    public const int MaxFailedAttempts = 5;
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    public long Id { get; private set; }
    public required string Uid { get; init; }
    public required string Email { get; set; }                  // lower-case, trimmed
    public string? PasswordHash { get; set; }
    public int FailedAttempts { get; set; }
    public DateTime? LockedUntil { get; set; }
    public DateTime CreatedOn { get; init; }
    public DateTime? PasswordChangedOn { get; set; }

    public bool IsLockedOut(DateTime now) => LockedUntil is { } until && until > now;

    public void RecordFailure(DateTime now)
    {
        FailedAttempts++;
        if (FailedAttempts >= MaxFailedAttempts)
        {
            LockedUntil = now + LockoutDuration;
            FailedAttempts = 0;
        }
    }

    public void RecordSuccess()
    {
        FailedAttempts = 0;
        LockedUntil = null;
    }

    public static string Normalize(string email) => email.Trim().ToLowerInvariant();
}
