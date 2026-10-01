namespace QuizMaster.Domain.AccessRequests;

public partial class AccessRequest
{
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

        return new AccessRequest
        {
            Kind = kind,
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            MobileNumber = mobileNumber.Trim(),
            SignInEmail = signInEmail.Trim().ToLowerInvariant(),
            PasswordHash = passwordHash,
            ContactEmail = Clean(hints.ContactEmail)?.ToLowerInvariant(),
            SchoolName = Clean(hints.SchoolName),
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
    string? ContactEmail = null, string? SchoolName = null, string? GradeName = null,
    string? ParentName = null, string? ParentMobileNumber = null, string? Note = null);
