namespace QuizMaster.Domain.AccessRequests;

// A visitor without a registration key asking to join: a parent, or a child. The platform administrator reviews it, and
// approving it creates the account in the organization they choose.
//insight - it belongs to no tenant (no IMultitenancy): the visitor has no account and no key, so nothing they send can
// say which organization they are in. What they typed about their school, grade and parent is a hint for the reviewer,
// never a reference; the organization, class and parent are the reviewer's choices.
public partial class AccessRequest : AggregateRoot
{
    private AccessRequest() {}                                   // use AccessRequest.Submit(...)

    public AccessRequestKind Kind { get; private set; }

    public string FirstName { get; private set; } = null!;
    public string LastName { get; private set; } = null!;
    public string MobileNumber { get; private set; } = null!;     // as typed

    // What they will sign in with once approved (a family's is built from the mobile number). One pending request each.
    public string SignInEmail { get; private set; } = null!;

    // Chosen by the visitor and hashed on arrival; it becomes their sign-in credential's on approval, so they sign in with
    // the password they picked and nobody else ever learns it.
    public string PasswordHash { get; private set; } = null!;

    // Hints for the reviewer: free text, never checked against anything. Every request names a school; a child's also
    // names a grade, which is why GradeName stays nullable (a parent's request has none). Requests stored before the
    // school was required carry an empty one.
    public string? ContactEmail { get; private set; }            // a parent's
    public string SchoolName { get; private set; } = null!;
    public string? GradeName { get; private set; }               // a child's; required for one
    public string? ParentName { get; private set; }              // a child's
    public string? ParentMobileNumber { get; private set; }      // a child's
    public string? Note { get; private set; }

    public AccessRequestStatus Status { get; private set; }
    public int? DecidedById { get; private set; }
    public DateTime? DecidedOn { get; private set; }
    public string? RejectionReason { get; private set; }

    // Approved only: the organization the reviewer chose and the account created there.
    public int? ApprovedTenantId { get; private set; }
    public int? ApprovedUserId { get; private set; }

    public bool IsPending => Status == AccessRequestStatus.Pending;
}
