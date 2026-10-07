using static QuizMaster.Domain.Tests.TestData;

namespace QuizMaster.Domain.Tests;

public class AccessRequestTests
{
    private const int PlatformAdminId = 9;
    private static readonly TestAction Visitor = Action(QuizMasterActionType.SubmitAccessRequest, byUserId: 0);

    private static AccessRequest Parent(AccessRequestHints? hints = null)
        => AccessRequest.Submit(AccessRequestKind.Parent, " Mona ", " Adel ", "0100 123 4567", "01001234567@MOBILE.local", "hash",
            hints ?? new(SchoolName: "Acme School", ChildrenCount: 2), Visitor);

    private static AccessRequest Child(AccessRequestHints? hints = null)
        => AccessRequest.Submit(AccessRequestKind.Child, "Omar", "Adel", "0111", "0111@mobile.local", "hash",
            hints ?? new(SchoolName: "Acme School", GradeName: "Grade 3"), Visitor);

    [Fact]
    public void A_new_request_waits_for_a_decision()
    {
        var request = Parent(new AccessRequestHints(ContactEmail: " Mona@Example.com ", SchoolName: " Acme School ", Note: " Two kids ", ChildrenCount: 2));

        Assert.Equal(AccessRequestStatus.Pending, request.Status);
        Assert.Equal(("Mona", "Adel", "01001234567@mobile.local"), (request.FirstName, request.LastName, request.SignInEmail));
        Assert.Equal(("mona@example.com", "Acme School", "Two kids", 2), (request.ContactEmail, request.SchoolName, request.Note, request.ChildrenCount));
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0)]
    [InlineData(51)]
    public void A_parent_says_how_many_children_they_will_follow(int? childrenCount)
        => Assert.Equal(AccessRequest.ChildrenCountMessage,
            Assert.Throws<DomainException>(() => Parent(new AccessRequestHints(SchoolName: "Acme", ChildrenCount: childrenCount))).Message);

    [Fact]
    public void A_child_gives_no_children_count()
        => Assert.Throws<DomainException>(() => Child(new AccessRequestHints(SchoolName: "Acme", GradeName: "Grade 3", ChildrenCount: 1)));

    [Fact]
    public void Only_a_child_names_a_grade_or_a_parent()
    {
        Assert.Throws<DomainException>(() => Parent(new AccessRequestHints(SchoolName: "Acme", GradeName: "Grade 3")));
        Assert.Throws<DomainException>(() => Parent(new AccessRequestHints(SchoolName: "Acme", ParentMobileNumber: "0100")));

        var child = Child(new AccessRequestHints(SchoolName: "Acme", GradeName: "Grade 3", ParentName: "Mona Adel", ParentMobileNumber: "0100"));
        Assert.Equal(("Grade 3", "Mona Adel", "0100"), (child.GradeName, child.ParentName, child.ParentMobileNumber));
    }

    [Fact]
    public void A_child_has_no_contact_email()
        => Assert.Throws<DomainException>(() => Child(new AccessRequestHints(ContactEmail: "kid@example.com", SchoolName: "Acme", GradeName: "Grade 3")));

    [Fact]
    public void Everyone_names_a_school()
    {
        Assert.Throws<DomainException>(() => Parent(new AccessRequestHints(SchoolName: " ")));
        Assert.Throws<DomainException>(() => Child(new AccessRequestHints(SchoolName: "", GradeName: "Grade 3")));
    }

    [Fact]
    public void A_student_names_a_grade()
    {
        Assert.Throws<DomainException>(() => Child(new AccessRequestHints(SchoolName: "Acme")));
        Assert.Null(Parent().GradeName);                         // a parent has none to give
    }

    [Fact]
    public void Approving_records_the_organization_the_account_and_who_decided()
    {
        var request = Parent();

        request.Approve(tenantId: 3, userId: 42, Action(QuizMasterActionType.ApproveAccessRequest, PlatformAdminId));

        Assert.Equal(AccessRequestStatus.Approved, request.Status);
        Assert.Equal((3, 42, PlatformAdminId, Now), (request.ApprovedTenantId, request.ApprovedUserId, request.DecidedById, request.DecidedOn));
    }

    [Fact]
    public void Rejecting_keeps_the_reason_for_the_visitor()
    {
        var request = Child();

        request.Reject(" Ask your school for a registration key. ", Action(QuizMasterActionType.RejectAccessRequest, PlatformAdminId));

        Assert.Equal((AccessRequestStatus.Rejected, "Ask your school for a registration key."), (request.Status, request.RejectionReason));
        Assert.Null(request.ApprovedUserId);
    }

    [Fact]
    public void A_decision_is_final()
    {
        var approved = Parent();
        approved.Approve(3, 42, Action(QuizMasterActionType.ApproveAccessRequest, PlatformAdminId));
        Assert.Throws<DomainException>(() => approved.Approve(3, 43, Action(QuizMasterActionType.ApproveAccessRequest, PlatformAdminId)));
        Assert.Throws<DomainException>(() => approved.Reject(null, Action(QuizMasterActionType.RejectAccessRequest, PlatformAdminId)));

        var rejected = Parent();
        rejected.Reject(null, Action(QuizMasterActionType.RejectAccessRequest, PlatformAdminId));
        Assert.Throws<DomainException>(() => rejected.Approve(3, 42, Action(QuizMasterActionType.ApproveAccessRequest, PlatformAdminId)));
    }
}
