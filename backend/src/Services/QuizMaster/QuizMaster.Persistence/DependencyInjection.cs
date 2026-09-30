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
        services.AddScoped<DbConnection>(_ => new SqlConnection(connectionString));
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
}
