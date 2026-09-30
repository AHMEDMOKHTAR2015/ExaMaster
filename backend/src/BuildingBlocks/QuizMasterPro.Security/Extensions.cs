using QuizMasterPro.Abstractions.Enums;
using Microsoft.AspNetCore.Builder;

namespace QuizMasterPro.Security;

public static class Extensions
{
    // Two layers in one call: the role itself (RequireRole) + the role on this aggregate (AggregateRoleRequirement).
    public static TBuilder RequireRoleAuthorization<TBuilder>(this TBuilder builder, params string[] roles)
        where TBuilder : IEndpointConventionBuilder
        => builder.RequireAuthorization(policy =>
        {
            policy.RequireRole(roles);
            policy.Requirements.Add(new AggregateRoleRequirement(roles));
        });

    public static TBuilder RequireRoleAuthorization<TBuilder>(this TBuilder builder, params UserRoleType[] roles)
        where TBuilder : IEndpointConventionBuilder
        => builder.RequireAuthorization(policy =>
        {
            policy.RequireRole(roles.Select(r => r.ToString()));
            policy.Requirements.Add(new AggregateRoleRequirement(roles));
        });

    //insight - a service with several aggregates names the one its route "{id}" refers to, so the access checker
    // can answer "may this caller act on THIS participation / quiz / lock?" from the service's own data
    public static RouteHandlerBuilder RequireRoleAuthorization<TAggregate>(this RouteHandlerBuilder builder, params string[] roles)
        => builder.RequireAuthorization(policy =>
        {
            policy.RequireRole(roles);
            policy.Requirements.Add(new AggregateRoleRequirement(roles, typeof(TAggregate)));
        });
}
