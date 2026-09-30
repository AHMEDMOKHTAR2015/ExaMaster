using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace QuizMasterPro.Security;

public static class ConfigureAuthentication
{
    public const string AccessTokenScheme = "QuizMaster";
    public const string DevTokenScheme = "DevToken";
    private const string SelectorScheme = "QuizMasterOrDevelopment";

    //insight - this API is its own identity provider: POST /auth/sign-in checks the password and issues the access token
    // validated here. The token only proves WHO the caller is (claim "sub" = the account's uid); roles and tenant are
    // loaded from the database per request (UserClaimsTransformation), so revocation is instant.
    public static IServiceCollection AddQuizMasterAuthentication(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        var tokenOptions = configuration.GetSection(nameof(AuthTokenOptions)).Get<AuthTokenOptions>()
            ?? throw new InvalidOperationException($"The {nameof(AuthTokenOptions)} section is missing.");

        var devTokenOptions = configuration.GetSection(nameof(DevTokenOptions)).Get<DevTokenOptions>();
        var acceptDevTokens = environment.IsDevelopment() && devTokenOptions is not null;   // never outside Development

        var authentication = services.AddAuthentication(acceptDevTokens ? SelectorScheme : AccessTokenScheme);

        authentication.AddJwtBearer(AccessTokenScheme, options =>
        {
            options.MapInboundClaims = false;                    // keep "sub" as the account's uid
            options.Events = new JwtBearerEvents { OnMessageReceived = ReadHubToken };
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = tokenOptions.Issuer,
                ValidateAudience = true,
                ValidAudience = tokenOptions.Audience,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = AccessTokenIssuer.SigningKey(tokenOptions),
                ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                ValidateLifetime = true,
                RequireExpirationTime = true,
                ClockSkew = TimeSpan.FromMinutes(1),
                NameClaimType = "name",
                RoleClaimType = ClaimTypes.Role
            };
        });

        if (acceptDevTokens)
        {
            authentication.AddJwtBearer(DevTokenScheme, options =>
            {
                options.RequireHttpsMetadata = false;
                options.MapInboundClaims = false;
                options.Events = new JwtBearerEvents { OnMessageReceived = ReadHubToken };
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = devTokenOptions!.Issuer,
                    ValidateAudience = true,
                    ValidAudience = devTokenOptions.Issuer,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(devTokenOptions.Secret)),
                    RequireExpirationTime = true,
                    NameClaimType = "name",
                    RoleClaimType = ClaimTypes.Role
                };
            });

            authentication.AddPolicyScheme(SelectorScheme, SelectorScheme, options =>
                options.ForwardDefaultSelector = context =>
                    IsIssuedBy(context, devTokenOptions!.Issuer) ? DevTokenScheme : AccessTokenScheme);
        }

        return services;
    }

    // Where a live connection's token travels. A browser cannot put an Authorization header on a WebSocket, so the
    // SignalR client sends it as ?access_token=. Accepted there for the hub paths only — anywhere else a token in a
    // URL would end up in logs and history for nothing.
    public const string HubPathPrefix = "/hubs";

    private static Task ReadHubToken(MessageReceivedContext context)
    {
        if (HubToken(context.HttpContext) is { } token)
            context.Token = token;
        return Task.CompletedTask;
    }

    private static string? HubToken(HttpContext context)
        => context.Request.Path.StartsWithSegments(HubPathPrefix)
            && context.Request.Query["access_token"].ToString() is { Length: > 0 } token ? token : null;

    // Reads the token WITHOUT validating anything: it only picks which scheme will then validate it.
    private static bool IsIssuedBy(HttpContext context, string issuer)
    {
        var header = context.Request.Headers.Authorization.ToString();
        var token = header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? header["Bearer ".Length..].Trim() : HubToken(context);
        if (string.IsNullOrEmpty(token))
            return false;

        var handler = new JsonWebTokenHandler();
        return handler.CanReadToken(token) && handler.ReadJsonWebToken(token).Issuer == issuer;
    }
}
