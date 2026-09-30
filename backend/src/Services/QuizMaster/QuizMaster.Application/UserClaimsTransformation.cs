using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;

namespace QuizMaster.Application;

// Turns "a valid access token" into "this user of this organization, with these roles".
//insight - roles and tenant are read from the database on EVERY request, never trusted from the token: removing a role
// takes effect on the very next request, with no token to wait out. A signed-in person with no profile,
// a deactivated account, a suspended organization or a lapsed registration key gets no roles, and therefore reaches nothing role-protected.
public class UserClaimsTransformation(QuizMasterDbContext _dbContext) : IClaimsTransformation
{
    private const string AccountUidClaim = "sub";

    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        // runs once per authentication, possibly several times per request: transform only once
        if (principal.Identity?.IsAuthenticated != true || principal.HasClaim(claim => claim.Type == ClaimTypes.NameIdentifier))
            return principal;

        var signInUid = principal.FindFirstValue(AccountUidClaim);
        if (string.IsNullOrEmpty(signInUid))
            return principal;

        var now = DateTime.UtcNow;

        // Users are looked up across tenants: the tenant is what this lookup discovers.
        var profile = await _dbContext.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(user => user.SignInUid == signInUid)
            .Select(user => new
            {
                user.Id,
                user.TenantId,
                user.DisplayName,
                user.Email,
                user.IsActive,
                user.Roles,
                // a platform administrator belongs to no organization (TenantId 0), so there is none to be suspended
                TenantIsActive = user.TenantId == 0
                    || _dbContext.Tenants.Where(tenant => tenant.Id == user.TenantId).Select(tenant => tenant.IsActive).FirstOrDefault(),
                // no key, or one that is active and not expired (RegistrationKey.AdmissionProblemAt, written as SQL)
                KeyAdmits = user.RegistrationKeyId == null || _dbContext.RegistrationKeys.IgnoreQueryFilters()
                    .Any(key => key.Id == user.RegistrationKeyId && key.IsActive && (key.ExpiresOn == null || key.ExpiresOn > now))
            })
            .SingleOrDefaultAsync();

        if (profile is null)
            return principal;

        var identity = new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, profile.Id.ToString()),
            new Claim(ClaimTypes.Name, profile.DisplayName),
            new Claim(ClaimTypes.Email, profile.Email),
            new Claim(CustomClaimTypes.TenantId, profile.TenantId.ToString())
        ], authenticationType: "QuizMasterProfile");

        if (profile.IsActive && profile.TenantIsActive && profile.KeyAdmits)
            identity.AddClaims(profile.Roles.Select(role => new Claim(ClaimTypes.Role, role.ToString())));

        principal.AddIdentity(identity);
        return principal;
    }
}
