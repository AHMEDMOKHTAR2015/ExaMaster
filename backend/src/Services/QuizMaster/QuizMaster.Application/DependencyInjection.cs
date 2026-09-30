using System.Reflection;
using Blocks.Mapster;
using Blocks.MediatR.Behaviours;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using QuizMaster.Application.Features.Assignments.Shared;
using QuizMaster.Application.Features.Attempts.Shared;
using QuizMaster.Application.Features.Quizzes.Shared;
using QuizMaster.Application.Features.Accounts.Shared;
using QuizMaster.Application.Features.Registration.Shared;
using QuizMaster.Application.Features.Notifications.Shared;
using Microsoft.AspNetCore.Identity;
using QuizMaster.Application.SignIn;
using QuizMaster.Application.Realtime;
using Microsoft.Extensions.DependencyInjection.Extensions;
using QuizMaster.Persistence.Accounts;
using QuizMasterPro.Security;

namespace QuizMaster.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration configuration)
    {
        services
            .AddMapsterConfigsFromCurrentAssembly()                                   // IRegister configs (scan)
            .AddValidatorsFromAssembly(Assembly.GetExecutingAssembly())               // FluentValidation (scan)
            .AddMediatR(config =>
            {
                config.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly());

                config.AddOpenBehavior(typeof(AssignUserIdBehavior<,>));              // 1. who is acting (from the token + profile)
                config.AddOpenBehavior(typeof(ValidationBehavior<,>));                // 2. is the input well-formed
                config.AddOpenBehavior(typeof(LoggingBehavior<,>));                   // 3. time the handler
            });

        services.AddScoped<IDomainEventPublisher, DomainEventPublisher>();            // Blocks.MediatR implementation
        services.AddScoped<IAggregateAccessChecker, QuizMasterAccessChecker>();
        services.AddScoped<IClaimsTransformation, UserClaimsTransformation>();       // account uid -> user, tenant, roles

        // Sign-in: this service is its own identity provider
        services.AddSingleton<IPasswordHasher<SignInCredential>, PasswordHasher<SignInCredential>>();
        services.AddSingleton<AccessTokenIssuer>();
        services.AddScoped<ISignInAccounts, LocalSignInAccounts>();
        services.AddScoped<SignInSessions>();

        services.AddScoped<AttemptedQuizLoader>();
        services.AddScoped<BankQuizReferences>();
        services.AddScoped<AssignmentReferences>();
        services.AddScoped<FamilyEnrolment>();
        services.AddScoped<RegistrationScope>();
        services.AddScoped<NotificationSender>();
        services.TryAddScoped<IRealtimeNotifier, NoRealtimeNotifier>();      // the API replaces it with SignalR

        return services;
    }
}
