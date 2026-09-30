using Blocks.AspNetCore;
using Blocks.AspNetCore.Middleware;
using Blocks.AspNetCore.Middlewares;
using Blocks.EntityFrameworkCore;
using QuizMaster.API;
using QuizMaster.API.Endpoints;
using QuizMaster.Application;
using QuizMaster.Persistence;
using QuizMaster.Persistence.Seeding;

var builder = WebApplication.CreateBuilder(args);

#region Add
builder.Services
    .ConfigureApiOptions(builder.Configuration);            // options first: later registrations rely on them

builder.Services
    .AddApiServices(builder.Configuration, builder.Environment)   // API / infrastructure
    .AddApplicationServices(builder.Configuration)          // use cases, pipeline
    .AddPersistenceServices(builder.Configuration);         // DbContext, repositories, interceptors
#endregion

var app = builder.Build();

#region InitData
//insight - migrating at startup is a development convenience; run migrations from your CI/CD pipeline in production
app.Migrate<QuizMasterDbContext>();

await FirstRunSeed.EnsurePlatformAdministratorAsync(app.Services, app.Configuration, app.Logger);   // an empty database: the platform administrator only

var seedOptions = app.Configuration.GetSection(nameof(SeedOptions)).Get<SeedOptions>() ?? new();
if (app.Environment.IsDevelopment() && seedOptions.DemoSchool)
{
    await app.Services.SeedDevelopmentDataAsync();          // opt-in: the demo school + accounts matching the dev token tool
    await DevelopmentSignIns.EnsureAsync(app.Services, app.Logger);    // + their passwords, so the app can sign in as them
}
#endregion

#region Use
app
    .UseSwagger()
    .UseSwaggerUI()
    .UseMiddleware<GlobalExceptionMiddleware>()             // early: translates every exception below into a response
    .UseMiddleware<RequestContextMiddleware>()              // correlation id + logging scope
    .UseMiddleware<RequestDiagnosticsMiddleware>()          // timing, [PerfWarn]
    .UseClientAppFiles()                                    // the built Angular app from wwwroot (none in development)
    .UseRouting()
    .UseCors(QuizMaster.API.DependencyInjection.ClientAppCorsPolicy)
    .UseAuthentication()
    .UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous().ExcludeFromDescription();
app.MapAllEndpoints();
app.MapHub<QuizMaster.API.Realtime.NotificationsHub>(QuizMaster.API.Realtime.NotificationsHub.Path);
app.MapClientApp();                                         // last: client-side routes fall back to index.html
#endregion

app.Run();

// Exposed for integration tests (WebApplicationFactory<Program>).
public partial class Program;
