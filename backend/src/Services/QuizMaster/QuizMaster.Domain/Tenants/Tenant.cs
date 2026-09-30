namespace QuizMaster.Domain.Tenants;

// A client organization (a school, or a district buying the platform). Every other aggregate belongs to exactly one.
public partial class Tenant : AggregateRoot
{
    private Tenant() {}                                          // use Tenant.Create(...)

    // Stable external key: the organization's permanent id.
    public required string Slug { get; init; }
    public string Name { get; private set; } = null!;

    // false suspends the whole organization (e.g. a lapsed subscription): its members lose every role.
    public bool IsActive { get; private set; }
    public TenantPlan Plan { get; private set; }

    public string? LogoUrl { get; private set; }
    public string? PrimaryColor { get; private set; }
}
