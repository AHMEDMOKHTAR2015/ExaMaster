using System.Text.RegularExpressions;

namespace QuizMaster.Domain.Tenants;

public partial class Tenant
{
    public const int MaxSlugLength = 64;

    // Lower-case letters, digits, '-' and '_' (the app's original rule, so no existing organization id became invalid).
    private static readonly Regex SlugPattern = new("^[a-z0-9][a-z0-9_-]*$", RegexOptions.Compiled);

    // Creating an organization is the vendor's action (seeding, or a platform administrator), never a tenant's.
    public static Tenant Create(string slug, string name, TenantPlan plan, IQuizMasterAction action)
    {
        Guard.ThrowIfNullOrWhiteSpace(slug);
        Guard.ThrowIfNullOrWhiteSpace(name);

        var normalizedSlug = slug.Trim().ToLowerInvariant();
        if (normalizedSlug.Length > MaxSlugLength || !SlugPattern.IsMatch(normalizedSlug))
            throw new DomainException("An organization id may contain only lower-case letters, digits, '-' and '_', and must start with a letter or digit.");

        return new Tenant
        {
            Slug = normalizedSlug,
            Name = name.Trim(),
            Plan = plan,
            IsActive = true,
            CreatedById = action.CreatedById,
            CreatedOn = action.CreatedOn
        };
    }

    // The slug never changes: it is the organization's permanent external id.
    public void UpdateProfile(string name, TenantPlan plan, string? logoUrl, string? primaryColor, IQuizMasterAction action)
    {
        Guard.ThrowIfNullOrWhiteSpace(name);
        if (!Enum.IsDefined(plan))
            throw new DomainException("Unknown plan.");
        if (!string.IsNullOrWhiteSpace(primaryColor) && !AcademicRules.HexColor.IsMatch(primaryColor.Trim()))
            throw new DomainException("A brand colour must be written as #RRGGBB.");

        Name = name.Trim();
        Plan = plan;
        LogoUrl = string.IsNullOrWhiteSpace(logoUrl) ? null : logoUrl.Trim();
        PrimaryColor = string.IsNullOrWhiteSpace(primaryColor) ? null : primaryColor.Trim();
        Touch(action);
    }

    //insight - suspension is the vendor's lever (a lapsed subscription): every member loses every role on their next
    // request (UserClaimsTransformation), and nothing is deleted, so reactivating restores the school exactly as it was
    public void Suspend(IQuizMasterAction action)
    {
        IsActive = false;
        Touch(action);
    }

    public void Reactivate(IQuizMasterAction action)
    {
        IsActive = true;
        Touch(action);
    }

    private void Touch(IQuizMasterAction action)
    {
        LastModifiedById = action.CreatedById;
        LastModifiedOn = action.CreatedOn;
    }
}
