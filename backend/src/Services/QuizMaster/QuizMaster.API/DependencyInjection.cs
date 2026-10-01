using Microsoft.Extensions.DependencyInjection.Extensions;
using QuizMaster.API.Realtime;
using QuizMaster.Application.Realtime;
using System.Text.Json;
using System.Text.Json.Serialization;
using Blocks.AspNetCore;
using Blocks.Core;
using Blocks.Core.Context;
using Blocks.Core.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.OpenApi;
using System.Threading.RateLimiting;
using QuizMaster.API.Endpoints.AccessRequests;

namespace QuizMaster.API;

public static class DependencyInjection
{
    public const string ClientAppCorsPolicy = "ClientApp";

    public static void ConfigureApiOptions(this IServiceCollection services, IConfiguration config)
    {
        services
            .AddAndValidateOptions<AuthTokenOptions>(config)         // section name = class name; fails at startup if missing
            .AddAndValidateOptions<ClientAppOptions>(config)
            .Configure<JsonOptions>(opt =>
            {
                opt.SerializerOptions.PropertyNameCaseInsensitive = true;
                opt.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
            });
    }

    public static IServiceCollection AddApiServices(this IServiceCollection services, IConfiguration config, IHostEnvironment environment)
    {
        services
            .AddMemoryCache()
            .AddHttpContextAccessor()
            .AddEndpointsApiExplorer()
            .AddSwaggerGen(ConfigureSwagger)
            .AddQuizMasterAuthentication(config, environment)         // this API's own access tokens (+ dev tokens in Development)
            .AddAuthorization();

        // Live signals (inbox, review queue). One API instance needs nothing more; several need a backplane
        // (AddStackExchangeRedis, or Azure SignalR Service) so a signal sent on one reaches people connected to another.
        services.AddSignalR();
        services.RemoveAll<IRealtimeNotifier>();
        services.AddScoped<IRealtimeNotifier, SignalRRealtimeNotifier>();

        var allowedOrigins = config.GetSectionByTypeName<ClientAppOptions>().AllowedOrigins;
        services.AddCors(options => options.AddPolicy(ClientAppCorsPolicy, policy =>
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("X-Correlation-ID")));

        //insight - interface segregation: one implementation, inner layers depend only on the narrow capability they need
        services
            .AddScoped<IClaimsProvider, HttpContextProvider>()
            .AddScoped<IRouteProvider, HttpContextProvider>()
            .AddScoped<ITenantProvider, HttpContextProvider>()        // tenant isolation in QuizMasterDbContext
            .AddScoped<HttpContextProvider>();

        services.AddScoped<RequestContext>();

        //insight - the anonymous access-request form is the one endpoint anyone can fill a table through, so it is limited
        // per client address. Behind a proxy the address is the proxy's unless forwarded headers are honoured
        // (App Service sets ASPNETCORE_FORWARDEDHEADERS_ENABLED for containers).
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(SubmitAccessRequestEndpoint.RateLimitPolicy, context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromHours(1) }));
            // the body GlobalExceptionMiddleware writes (PascalCase), which the app reads its message from
            options.OnRejected = async (context, ct) =>
            {
                context.HttpContext.Response.ContentType = "application/json";
                await context.HttpContext.Response.WriteAsync(JsonSerializer.Serialize(new
                {
                    StatusCode = StatusCodes.Status429TooManyRequests,
                    Message = "Too many requests were sent from this device. Try again in an hour.",
                    TraceId = context.HttpContext.TraceIdentifier
                }), ct);
            };
        });

        // authorization layer 2: role on THIS aggregate (see QuizMasterAccessChecker)
        services.AddScoped<IAuthorizationHandler, AggregateAccessAuthorizationHandler>();

        return services;
    }

    private static void ConfigureSwagger(Swashbuckle.AspNetCore.SwaggerGen.SwaggerGenOptions options)
    {
        options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            Description = "An access token from POST /api/auth/sign-in, or in Development: dotnet run --project tools/QuizMasterPro.DevToken -- --uid dev-student"
        });
        options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference("Bearer", document)] = []
        });
        options.CustomSchemaIds(type => type.FullName!.Replace('+', '.'));   // several slices name a record "…Response"
    }
}
