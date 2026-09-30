namespace Blocks.Core.Security;

// The caller's tenant (organization), for data isolation. Null when the caller belongs to none
// (a platform administrator, an account not yet placed in an organization, or no caller at all).
public interface ITenantProvider
{
    int? TryGetTenantId();
}
