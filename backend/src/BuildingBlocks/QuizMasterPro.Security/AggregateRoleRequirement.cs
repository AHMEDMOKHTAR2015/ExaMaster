using QuizMasterPro.Abstractions.Enums;
using Blocks.Core;
using Microsoft.AspNetCore.Authorization;

namespace QuizMasterPro.Security;

public class AggregateRoleRequirement : IAuthorizationRequirement
{
    public IReadOnlySet<UserRoleType> AllowedRoles { get; }

    // The aggregate the route "{id}" refers to; null = role layer only.
    public Type? AggregateType { get; }

    public AggregateRoleRequirement(IEnumerable<string> allowedRoles, Type? aggregateType = null)
        => (AllowedRoles, AggregateType) = (allowedRoles.Select(r => r.ToEnum<UserRoleType>()).ToHashSet(), aggregateType);

    public AggregateRoleRequirement(IEnumerable<UserRoleType> allowedRoles, Type? aggregateType = null)
        => (AllowedRoles, AggregateType) = (allowedRoles.ToHashSet(), aggregateType);
}
