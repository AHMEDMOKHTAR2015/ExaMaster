using static QuizMaster.Domain.Tests.TestData;

namespace QuizMaster.Domain.Tests;

public class TenantTests
{
    private static readonly TestAction Vendor = Action(QuizMasterActionType.CreateTenant, 9);

    [Theory]
    [InlineData("acme-school")]
    [InlineData("acme_school")]                 // the app allowed '_'
    [InlineData("school42")]
    public void The_apps_organization_ids_are_accepted(string slug)
        => Assert.Equal(slug, Tenant.Create(slug, "Acme", TenantPlan.Standard, Vendor).Slug);

    [Theory]
    [InlineData("-acme")]
    [InlineData("_acme")]
    [InlineData("acme school")]
    [InlineData("acme/school")]
    public void Anything_that_is_not_a_clean_id_is_refused(string slug)
        => Assert.Throws<DomainException>(() => Tenant.Create(slug, "Acme", TenantPlan.Standard, Vendor));

    [Fact]
    public void An_id_is_normalized_to_lower_case()
        => Assert.Equal("acme", Tenant.Create(" ACME ", "Acme", TenantPlan.Trial, Vendor).Slug);

    [Fact]
    public void A_new_organization_is_active()
        => Assert.True(Tenant.Create("acme", "Acme", TenantPlan.Trial, Vendor).IsActive);

    [Fact]
    public void Suspension_is_reversible()
    {
        var tenant = Tenant.Create("acme", "Acme", TenantPlan.Trial, Vendor);

        tenant.Suspend(Action(QuizMasterActionType.SuspendTenant, 9));
        Assert.False(tenant.IsActive);

        tenant.Reactivate(Action(QuizMasterActionType.ReactivateTenant, 9));
        Assert.True(tenant.IsActive);
    }

    [Fact]
    public void The_profile_changes_but_the_id_never_does()
    {
        var tenant = Tenant.Create("acme", "Acme", TenantPlan.Trial, Vendor);

        tenant.UpdateProfile(" Acme Academy ", TenantPlan.Enterprise, "https://acme.test/logo.png", "#1565C0", Action(QuizMasterActionType.UpdateTenant, 9));

        Assert.Equal(("acme", "Acme Academy", TenantPlan.Enterprise, "#1565C0"), (tenant.Slug, tenant.Name, tenant.Plan, tenant.PrimaryColor));
    }

    [Fact]
    public void A_brand_colour_must_be_a_hex_colour()
        => Assert.Throws<DomainException>(() => Tenant.Create("acme", "Acme", TenantPlan.Trial, Vendor)
            .UpdateProfile("Acme", TenantPlan.Trial, null, "blue", Action(QuizMasterActionType.UpdateTenant, 9)));
}
