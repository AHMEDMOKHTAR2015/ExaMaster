namespace QuizMasterPro.Security;

// Development only: tokens minted by tools/QuizMasterPro.DevToken, so the API can be exercised without signing in with a password.
// Honoured only when ASPNETCORE_ENVIRONMENT=Development AND this section exists (appsettings.Development.json).
public record DevTokenOptions
{
    public required string Issuer { get; init; }
    public required string Secret { get; init; }
}
