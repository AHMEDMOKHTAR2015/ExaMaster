using QuizMasterPro.Abstractions.Enums;
using Blocks.AspNetCore;
using Microsoft.AspNetCore.Authorization;

namespace QuizMasterPro.Security;

// Layer 2 of authorization: "does the user hold one of the allowed roles ON THIS aggregate?"
// The aggregate id comes from the route value named RouteKeys.AggregateId ("id"), its type from the requirement.
public class AggregateAccessAuthorizationHandler(HttpContextProvider _httpProvider, IAggregateAccessChecker _accessChecker)
    : AuthorizationHandler<AggregateRoleRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, AggregateRoleRequirement requirement)
    {
        var userRoles = _httpProvider.GetUserRoles<UserRoleType>()
                            .Where(requirement.AllowedRoles.Contains)
                            .ToHashSet();

        if (userRoles.Count > 0 && await HasUserRoleForAggregate(requirement.AggregateType, userRoles))
            context.Succeed(requirement);
    }

    private async Task<bool> HasUserRoleForAggregate(Type? aggregateType, IReadOnlySet<UserRoleType> userRoles)
        => await _accessChecker.HasAccessAsync(
            aggregateType, _httpProvider.GetAggregateId(), _httpProvider.TryGetUserId(), userRoles, _httpProvider.HttpContext.RequestAborted);
}
