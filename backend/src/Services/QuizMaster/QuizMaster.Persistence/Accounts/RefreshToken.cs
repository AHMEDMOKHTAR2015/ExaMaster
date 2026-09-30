namespace QuizMaster.Persistence.Accounts;

// One signed-in session. Only the token's hash is stored. Rotated on every use: the old one is revoked and names its
// successor, so presenting a revoked token again means it was stolen — every session of that account is then ended.
public class RefreshToken
{
    public long Id { get; private set; }
    public required string Uid { get; init; }
    public required string TokenHash { get; init; }
    public DateTime CreatedOn { get; init; }
    public DateTime ExpiresOn { get; init; }
    public DateTime? RevokedOn { get; set; }
    public string? ReplacedByHash { get; set; }

    public bool IsActive(DateTime now) => RevokedOn is null && ExpiresOn > now;
}
