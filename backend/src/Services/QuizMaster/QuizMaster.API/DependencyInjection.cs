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
using Microsoft.AspNetCore.SignalR;
using Microsoft.OpenApi;
using QuizMaster.API.Security;

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
            //insight - deny by default: an endpoint that declares no rule of its own still needs a signed-in caller, so
            // forgetting RequireRoleAuthorization on a new endpoint can never make it public (anonymous ones say AllowAnonymous)
            .AddAuthorization(options => options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

        // Live signals (inbox, review queue). One API instance needs nothing more; several need a backplane
        // (AddStackExchangeRedis, or Azure SignalR Service) so a signal sent on one reaches people connected to another.
        services.AddSignalR()
            // the teaching-room board carries states: enums by name, as the REST API writes them
            .AddJsonProtocol(options => options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
            .AddHubOptions<TeachingRoomHub>(options => options.AddFilter<HubHttpContextFilter>());
        services.RemoveAll<IRealtimeNotifier>();
        services.AddScoped<IRealtimeNotifier, SignalRRealtimeNotifier>();

        // The teaching-room board: groups per room, filled only by TeachingRoomHub.JoinRoom (see TeachingRoomConnections
        // on what one instance means for it).
        services.AddSingleton<TeachingRoomConnections>();
        services.RemoveAll<ITeachingRoomBroadcaster>();
        services.AddScoped<ITeachingRoomBroadcaster, SignalRTeachingRoomBroadcaster>();

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

        // per-address limits on the endpoints anyone can call (sign-in, renewal, registration, access requests)
        services.AddQuizMasterRateLimits(config, environment);

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
