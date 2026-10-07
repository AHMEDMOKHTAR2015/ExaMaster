namespace QuizMaster.Domain.AccessRequests;

public partial class AccessRequest
{
    public const string SchoolRequiredMessage = "Enter the name of your school.";
    public const string GradeRequiredMessage = "Enter the grade you are in.";
    public const string ChildrenCountMessage = "Enter how many children you want to follow (1 to 50).";
    public const int MaxChildrenCount = 50;                      // the same cap the reviewer's family key takes

    public static AccessRequest Submit(
        AccessRequestKind kind, string firstName, string lastName, string mobileNumber, string signInEmail, string passwordHash,
        AccessRequestHints hints, IQuizMasterAction action)
    {
        Guard.ThrowIfNullOrWhiteSpace(firstName);
        Guard.ThrowIfNullOrWhiteSpace(lastName);
        Guard.ThrowIfNullOrWhiteSpace(mobileNumber);
        Guard.ThrowIfNullOrWhiteSpace(signInEmail);
        Guard.ThrowIfNullOrWhiteSpace(passwordHash);

        if (!Enum.IsDefined(kind))
            throw new DomainException("An access request is for a parent or a child account.");

        var isChild = kind == AccessRequestKind.Child;
        if (!isChild && (hints.GradeName is not null || hints.ParentName is not null || hints.ParentMobileNumber is not null))
            throw new DomainException("Only a child's request names a grade or a parent.");
        if (isChild && hints.ContactEmail is not null)
            throw new DomainException("A child's request carries no contact email.");
        if (isChild && hints.ChildrenCount is not null)
            throw new DomainException("A child's request carries no children count.");

        //insight - required although never matched against anything: without them the reviewer has no way to tell which
        // organization (and, for a student, which class) the request belongs in
        if (string.IsNullOrWhiteSpace(hints.SchoolName))
            throw new DomainException(SchoolRequiredMessage);
        if (isChild && string.IsNullOrWhiteSpace(hints.GradeName))
            throw new DomainException(GradeRequiredMessage);
        // a parent says how many children they will follow, so the reviewer can size their family key
        if (!isChild && hints.ChildrenCount is not (>= 1 and <= MaxChildrenCount))
            throw new DomainException(ChildrenCountMessage);

        return new AccessRequest
        {
            Kind = kind,
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            MobileNumber = mobileNumber.Trim(),
            SignInEmail = signInEmail.Trim().ToLowerInvariant(),
            PasswordHash = passwordHash,
            ContactEmail = Clean(hints.ContactEmail)?.ToLowerInvariant(),
            ChildrenCount = hints.ChildrenCount,
            SchoolName = hints.SchoolName.Trim(),
            GradeName = Clean(hints.GradeName),
            ParentName = Clean(hints.ParentName),
            ParentMobileNumber = Clean(hints.ParentMobileNumber),
            Note = Clean(hints.Note),
            Status = AccessRequestStatus.Pending,
            CreatedById = action.CreatedById,
            CreatedOn = action.CreatedOn
        };
    }

    // The account now exists in the organization the reviewer chose; the request records where, and stays as the history.
    public void Approve(int tenantId, int userId, IQuizMasterAction action)
    {
        EnsurePending();
        if (tenantId <= 0 || userId <= 0)
            throw new DomainException("An approved request names the organization and the account it created.");

        (ApprovedTenantId, ApprovedUserId) = (tenantId, userId);
        Decide(AccessRequestStatus.Approved, action);
    }

    public void Reject(string? reason, IQuizMasterAction action)
    {
        EnsurePending();
        RejectionReason = Clean(reason);
        Decide(AccessRequestStatus.Rejected, action);
    }

    //insight - a decision is final: approving twice would create a second account, and re-opening a rejection would let
    // the reviewer's "no" be undone without a new request. A visitor turned down sends a new request instead.
    public void EnsurePending()
    {
        if (!IsPending)
            throw new DomainException(Status == AccessRequestStatus.Approved
                ? "This request has already been approved."
                : "This request has already been rejected.");
    }

    private void Decide(AccessRequestStatus status, IQuizMasterAction action)
    {
        Status = status;
        DecidedById = action.CreatedById;
        DecidedOn = action.CreatedOn;
        LastModifiedById = action.CreatedById;
        LastModifiedOn = action.CreatedOn;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

// What the visitor said about themselves that only a person can act on.
public sealed record AccessRequestHints(
    string SchoolName, string? ContactEmail = null, string? GradeName = null,
    string? ParentName = null, string? ParentMobileNumber = null, string? Note = null, int? ChildrenCount = null);
