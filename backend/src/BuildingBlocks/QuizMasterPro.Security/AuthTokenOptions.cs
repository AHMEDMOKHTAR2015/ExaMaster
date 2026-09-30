using System.ComponentModel.DataAnnotations;

namespace QuizMasterPro.Security;

// How this API signs the tokens it issues at sign-in. The signing key is a secret: set it per environment
// (AuthTokenOptions__SigningKey), never in a committed appsettings file other than Development's.
public record AuthTokenOptions
{
    public const int MinimumSigningKeyLength = 32;              // 256 bits for HMAC-SHA256

    [Required]
    public required string Issuer { get; init; }

    [Required]
    public required string Audience { get; init; }

    [Required, MinLength(MinimumSigningKeyLength)]
    public required string SigningKey { get; init; }

    // Short: an access token cannot be revoked, only allowed to expire. The refresh token is what keeps a session.
    [Range(1, 24 * 60)]
    public int AccessTokenMinutes { get; init; } = 30;

    [Range(1, 365)]
    public int RefreshTokenDays { get; init; } = 30;
}
