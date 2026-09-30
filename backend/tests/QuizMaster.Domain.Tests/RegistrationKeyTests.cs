using static QuizMaster.Domain.Tests.TestData;

namespace QuizMaster.Domain.Tests;

public class RegistrationKeyTests
{
    private static RegistrationKey ParentKey(DateTime? expiresOn = null, int? maxChildren = null)
    {
        var key = RegistrationKey.Create(UserRoleType.PARENT, expiresOn ?? Now.AddDays(30), maxChildren, Action(QuizMasterActionType.CreateRegistrationKey, AdminId)).WithId(70);
        key.TenantId = 1;
        return key;
    }

    private static RegistrationKey ClaimedKey(int? maxChildren = null)
    {
        var key = ParentKey(maxChildren: maxChildren);
        key.ClaimFor(Parent(), Action(QuizMasterActionType.Register, ParentId));
        return key;
    }

    [Fact]
    public void Only_parent_and_administrator_keys_exist()
    {
        Assert.Throws<DomainException>(() => RegistrationKey.Create(UserRoleType.TEACHER, null, null, Action(QuizMasterActionType.CreateRegistrationKey, AdminId)));
        Assert.Throws<DomainException>(() => RegistrationKey.Create(UserRoleType.STUDENT, null, null, Action(QuizMasterActionType.CreateRegistrationKey, AdminId)));
    }

    [Fact]
    public void An_administrator_key_has_no_children_allowance()
        => Assert.Throws<DomainException>(() => RegistrationKey.Create(UserRoleType.APPLICATION_ADMIN, null, 3, Action(QuizMasterActionType.CreateRegistrationKey, AdminId)));

    [Fact]
    public void Every_key_gets_its_own_unguessable_code()
        => Assert.NotEqual(ParentKey().Code, ParentKey().Code);

    [Fact]
    public void Status_follows_the_apps_order_inactive_then_expired_then_used()
    {
        var key = ClaimedKey();
        Assert.Equal(RegistrationKeyStatus.Used, key.StatusAt(Now));
        Assert.Equal(RegistrationKeyStatus.Expired, key.StatusAt(Now.AddDays(31)));

        key.Deactivate(Action(QuizMasterActionType.UpdateRegistrationKey, AdminId));
        Assert.Equal(RegistrationKeyStatus.Inactive, key.StatusAt(Now.AddDays(31)));
    }

    [Fact]
    public void A_key_expires_at_the_instant_it_names()
    {
        var key = ParentKey(expiresOn: Now);
        Assert.Equal(RegistrationKeyProblem.Expired, key.AdmissionProblemAt(Now));
        Assert.Null(key.AdmissionProblemAt(Now.AddTicks(-1)));
    }

    [Fact]
    public void A_parent_key_admits_one_family_only()
    {
        var key = ClaimedKey();

        Assert.Throws<DomainException>(() => key.EnsureOpenForRegistration(Now));

        var otherParent = User.Create(1, "uid-other", "other@school.test", "Other", [UserRoleType.PARENT], Action(QuizMasterActionType.Seed, 0)).WithId(99);
        Assert.Throws<DomainException>(() => key.ClaimFor(otherParent, Action(QuizMasterActionType.CreateAccount, AdminId)));
    }

    [Fact]
    public void Claiming_again_for_the_same_parent_changes_nothing()
    {
        var key = ClaimedKey();
        var claimedOn = key.ClaimedOn;

        key.ClaimFor(Parent(), Action(QuizMasterActionType.CreateAccount, AdminId, Now.AddDays(1)));

        Assert.Equal(ParentId, key.ParentId);
        Assert.Equal(claimedOn, key.ClaimedOn);
    }

    [Fact]
    public void A_key_cannot_be_claimed_across_organizations()
    {
        var key = ParentKey();
        key.TenantId = 2;
        Assert.Throws<DomainException>(() => key.ClaimFor(Parent(), Action(QuizMasterActionType.Register, ParentId)));
    }

    [Fact]
    public void Children_are_counted_against_the_allowance()
    {
        var key = ClaimedKey(maxChildren: 2);

        key.SpendChildSlot(ParentId, Now, Action(QuizMasterActionType.AddChild, ParentId));
        key.SpendChildSlot(ParentId, Now, Action(QuizMasterActionType.AddChild, ParentId));

        Assert.Equal(2, key.ChildCount);
        var full = Assert.Throws<DomainException>(() => key.SpendChildSlot(ParentId, Now, Action(QuizMasterActionType.AddChild, ParentId)));
        Assert.Contains("all are in use", full.Message);
    }

    [Fact]
    public void A_key_without_an_allowance_is_unlimited()
    {
        var key = ClaimedKey();
        for (var i = 0; i < 10; i++)
            key.SpendChildSlot(ParentId, Now, Action(QuizMasterActionType.AddChild, ParentId));
        Assert.Equal(10, key.ChildCount);
    }

    [Fact]
    public void A_child_is_charged_only_to_their_own_familys_key()
    {
        var unclaimed = ParentKey();
        Assert.Throws<DomainException>(() => unclaimed.SpendChildSlot(ParentId, Now, Action(QuizMasterActionType.AddChild, ParentId)));

        var claimed = ClaimedKey();
        Assert.Throws<DomainException>(() => claimed.SpendChildSlot(ParentId + 1, Now, Action(QuizMasterActionType.AddChild, ParentId + 1)));
    }

    [Fact]
    public void A_lapsed_key_enrols_no_more_children()
    {
        var key = ClaimedKey();
        Assert.Throws<DomainException>(() => key.SpendChildSlot(ParentId, Now.AddDays(31), Action(QuizMasterActionType.AddChild, ParentId)));

        key.Deactivate(Action(QuizMasterActionType.UpdateRegistrationKey, AdminId));
        Assert.Throws<DomainException>(() => key.SpendChildSlot(ParentId, Now, Action(QuizMasterActionType.AddChild, ParentId)));
    }

    [Fact]
    public void The_allowance_cannot_drop_below_the_children_already_enrolled()
    {
        var key = ClaimedKey(maxChildren: 3);
        key.SpendChildSlot(ParentId, Now, Action(QuizMasterActionType.AddChild, ParentId));
        key.SpendChildSlot(ParentId, Now, Action(QuizMasterActionType.AddChild, ParentId));

        Assert.Throws<DomainException>(() => key.UpdateTerms(Now.AddDays(30), 1, Action(QuizMasterActionType.UpdateRegistrationKey, AdminId)));
        key.UpdateTerms(Now.AddDays(60), 2, Action(QuizMasterActionType.UpdateRegistrationKey, AdminId));
        Assert.Equal(2, key.MaxChildren);
    }

    [Fact]
    public void An_account_holds_only_a_key_of_its_own_organization()
    {
        var key = ParentKey();
        key.TenantId = 2;
        Assert.Throws<DomainException>(() => Parent().HoldRegistrationKey(key, Action(QuizMasterActionType.Register, ParentId)));
    }

    [Fact]
    public void A_parent_key_is_not_held_by_staff()
        => Assert.Throws<DomainException>(() => Teacher().HoldRegistrationKey(ParentKey(), Action(QuizMasterActionType.CreateAccount, AdminId)));

    [Fact]
    public void A_child_leaving_the_family_gives_the_slot_back_but_never_below_zero()
    {
        var key = ClaimedKey(maxChildren: 1);
        key.SpendChildSlot(ParentId, Now, Action(QuizMasterActionType.AddChild, ParentId));

        key.ReleaseChildSlot(Action(QuizMasterActionType.LinkParent, AdminId));
        key.ReleaseChildSlot(Action(QuizMasterActionType.LinkParent, AdminId));

        Assert.Equal(0, key.ChildCount);
        key.SpendChildSlot(ParentId, Now, Action(QuizMasterActionType.AddChild, ParentId));   // the freed slot can be used again
    }

    [Fact]
    public void Renaming_changes_the_shown_name_only()
    {
        var parent = Parent();
        parent.Rename(" Paula ", " Parker ", Action(QuizMasterActionType.RenameUser, AdminId));

        Assert.Equal(("Paula", "Parker", "Paula Parker", "parent@school.test"), (parent.FirstName, parent.LastName, parent.DisplayName, parent.Email));
    }

    [Fact]
    public void A_family_is_never_put_on_an_administrator_key()
    {
        var adminKey = RegistrationKey.Create(UserRoleType.APPLICATION_ADMIN, null, null, Action(QuizMasterActionType.CreateRegistrationKey, AdminId)).WithId(71);
        adminKey.TenantId = 1;

        Assert.Throws<DomainException>(() => Parent().HoldRegistrationKey(adminKey, Action(QuizMasterActionType.CreateAccount, AdminId)));
        Admin().HoldRegistrationKey(adminKey, Action(QuizMasterActionType.Register, AdminId));      // staff may hold one
    }
}
