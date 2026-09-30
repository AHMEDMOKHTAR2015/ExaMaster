using QuizMasterPro.Abstractions.Enums;

namespace QuizMasterPro.Security;

// Implemented once per service against that service's OWN data (never a synchronous cross-service call).
// aggregateType is the aggregate named by RequireRoleAuthorization<TAggregate>(…); null when the endpoint checks roles only.
public interface IAggregateAccessChecker
{
    Task<bool> HasAccessAsync(Type? aggregateType, int? aggregateId, int? userId, IReadOnlySet<UserRoleType> roles, CancellationToken ct = default);
}
