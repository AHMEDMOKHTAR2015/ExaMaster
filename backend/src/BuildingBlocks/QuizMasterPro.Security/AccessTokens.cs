using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace QuizMasterPro.Security;

public sealed record IssuedAccessToken(string Token, DateTime ExpiresOn);

//insight - the token only proves WHO the caller is (claim "sub" = the account's uid). Roles and tenant are loaded from the
// database on every request (UserClaimsTransformation), so revoking a role takes effect on the very next request rather
// than when the token expires.
public sealed class AccessTokenIssuer(IOptions<AuthTokenOptions> options)
{
    private readonly AuthTokenOptions _options = options.Value;
    private readonly JsonWebTokenHandler _handler = new();

    public IssuedAccessToken Issue(string uid, DateTime now)
    {
        var expiresOn = now.AddMinutes(_options.AccessTokenMinutes);
        var token = _handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            Subject = new ClaimsIdentity([new Claim(JwtRegisteredClaimNames.Sub, uid)]),
            IssuedAt = now,
            NotBefore = now,
            Expires = expiresOn,
            SigningCredentials = new SigningCredentials(SigningKey(_options), SecurityAlgorithms.HmacSha256)
        });
        return new IssuedAccessToken(token, expiresOn);
    }

    public DateTime RefreshTokenExpiry(DateTime now) => now.AddDays(_options.RefreshTokenDays);

    internal static SymmetricSecurityKey SigningKey(AuthTokenOptions options) => new(Encoding.UTF8.GetBytes(options.SigningKey));
}

// A refresh token is a random secret the client keeps; only its hash is stored, so a copy of the database cannot be
// replayed as sessions.
public static class RefreshTokens
{
    public static string New() => Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));

    public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
