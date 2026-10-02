using System.Text.Json;
using System.Threading.RateLimiting;

namespace QuizMaster.API.Security;

// How fast one address may call the endpoints anyone can call: sign-in (password guessing across many accounts, which
// the per-account lockout cannot see), session renewal, self-registration and the access-request form.
// Tunable per environment (RateLimitOptions__SignInBurst=…) without a release.
public class RateLimitOptions
{
    //insight - a whole classroom signs in at once from one school address, so sign-in allows a burst that size and
    // then refills steadily; a script trying passwords across accounts gets SignInPerMinute guesses a minute at most
    public int SignInBurst { get; set; } = 60;
    public int SignInPerMinute { get; set; } = 30;
    public int SessionRefreshBurst { get; set; } = 120;
    public int SessionRefreshPerMinute { get; set; } = 60;
    public int RegistrationsPerHour { get; set; } = 30;
    public int AccessRequestsPerHour { get; set; } = 5;
}

public static class RateLimits
{
    public const string SignIn = "sign-in";
    public const string SessionRefresh = "session-refresh";
    public const string Registration = "registration";
    public const string AccessRequest = "access-requests";

    public static IServiceCollection AddQuizMasterRateLimits(this IServiceCollection services, IConfiguration config, IHostEnvironment environment)
    {
        var limits = config.GetSection(nameof(RateLimitOptions)).Get<RateLimitOptions>() ?? new RateLimitOptions();
        var behindProxy = !environment.IsDevelopment();

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.AddPolicy(SignIn, context => TokenBucket(ClientAddress.Of(context, behindProxy), limits.SignInBurst, limits.SignInPerMinute));
            options.AddPolicy(SessionRefresh, context => TokenBucket(ClientAddress.Of(context, behindProxy), limits.SessionRefreshBurst, limits.SessionRefreshPerMinute));
            options.AddPolicy(Registration, context => PerHour(ClientAddress.Of(context, behindProxy), limits.RegistrationsPerHour));
            options.AddPolicy(AccessRequest, context => PerHour(ClientAddress.Of(context, behindProxy), limits.AccessRequestsPerHour));

            // the body GlobalExceptionMiddleware writes (PascalCase), which the app reads its message from
            options.OnRejected = async (context, ct) =>
            {
                var http = context.HttpContext;
                http.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(RateLimits))
                    .LogWarning("Rate limit reached: {Method} {Path} from {Address}.", http.Request.Method, http.Request.Path, ClientAddress.Of(http, behindProxy));

                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    http.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
                http.Response.ContentType = "application/json";
                await http.Response.WriteAsync(JsonSerializer.Serialize(new
                {
                    StatusCode = StatusCodes.Status429TooManyRequests,
                    Message = "Too many requests were sent from this network. Wait a little, then try again.",
                    TraceId = http.TraceIdentifier
                }), ct);
            };
        });

        return services;
    }

    private static RateLimitPartition<string> TokenBucket(string address, int burst, int perMinute)
        => RateLimitPartition.GetTokenBucketLimiter(address, _ => new TokenBucketRateLimiterOptions
        {
            TokenLimit = burst,
            TokensPerPeriod = perMinute,
            ReplenishmentPeriod = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        });

    private static RateLimitPartition<string> PerHour(string address, int permits)
        => RateLimitPartition.GetFixedWindowLimiter(address, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = permits,
            Window = TimeSpan.FromHours(1),
            QueueLimit = 0
        });
}
