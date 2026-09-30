using System.Data.Common;
using Blocks.EntityFrameworkCore.Interceptors;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace QuizMaster.Persistence;

public static class DependencyInjection
{
    public static IServiceCollection AddPersistenceServices(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionStringOrThrow("Database");

        // post-save dispatch: domain-event handlers run after the commit
        services.AddScoped<ISaveChangesInterceptor, DispatchDomainEventsInterceptor>();

        // one DbConnection per scope, so any module DbContext can share the connection (and transaction)
        services.AddScoped<DbConnection>(_ => new SqlConnection(connectionString) { RetryLogicProvider = OpenRetry });
        services.AddDbContext<QuizMasterDbContext>((provider, options) =>
        {
            options.AddInterceptors(provider.GetServices<ISaveChangesInterceptor>());
            options.UseSqlServer(provider.GetRequiredService<DbConnection>());
        });

        services.AddScoped<TransactionProvider>();

        services.AddScoped(typeof(Repository<>));                    // simple aggregates
        services.AddDerivedTypesOf(typeof(Repository<>));             // every aggregate repository, automatically

        return services;
    }

    //insight - a serverless Azure SQL database pauses when idle and refuses connections (40613) for about a minute
    // while it resumes. Retrying the connection open waits that out, at startup (migrations) and on the first request
    // after a pause. EF's EnableRetryOnFailure is not an option: it rejects the explicit transactions this app opens.
    // 4060 is deliberately absent: EF relies on it to detect a missing database and create it.
    private static readonly SqlRetryLogicBaseProvider OpenRetry = SqlConfigurableRetryFactory.CreateExponentialRetryProvider(
        new SqlRetryLogicOption
        {
            NumberOfTries = 8,                                  // waits of ~2, 4, 8, 16, 20, 20, 20s: about 1.5 minutes
            DeltaTime = TimeSpan.FromSeconds(2),
            MaxTimeInterval = TimeSpan.FromSeconds(20),
            TransientErrors = [40613, 40197, 40501, 40540, 49918, 49919, 49920, 10928, 10929, 233, 64, 20, 10053, 10054, 10060],
        });
}
