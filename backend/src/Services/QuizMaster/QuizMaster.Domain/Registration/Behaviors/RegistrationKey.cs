namespace QuizMaster.Domain.Registration;

public partial class RegistrationKey
{
    // The roles a person may give themselves with a key. Teachers and students are always created by someone else.
    private static readonly UserRoleType[] SelfRegistrationRoles = [UserRoleType.PARENT, UserRoleType.APPLICATION_ADMIN];

    public static RegistrationKey Create(UserRoleType role, DateTime? expiresOn, int? maxChildren, IQuizMasterAction action)
    {
        if (!SelfRegistrationRoles.Contains(role))
            throw new DomainException("A registration key grants either the PARENT or the APPLICATION_ADMIN role.");

        var key = new RegistrationKey
        {
            Code = Guid.NewGuid().ToString(),                    // 122 random bits, the same shape as the app's keys
            Role = role,
            IsActive = true,
            CreatedById = action.CreatedById,
            CreatedOn = action.CreatedOn
        };
        key.ApplyTerms(expiresOn, maxChildren);
        return key;
    }

    public void UpdateTerms(DateTime? expiresOn, int? maxChildren, IQuizMasterAction action)
    {
        ApplyTerms(expiresOn, maxChildren);
        Touch(action);
    }

    public void Activate(IQuizMasterAction action)
    {
        IsActive = true;
        Touch(action);
    }

    public void Deactivate(IQuizMasterAction action)
    {
        IsActive = false;
        Touch(action);
    }

    // Order matters (as the app's resolveKeyStatus): switching a key off is deliberate and wins over running out of
    // time, and a claimed key that ran out of time reads as expired rather than used.
    public RegistrationKeyStatus StatusAt(DateTime now)
    {
        if (!IsActive) return RegistrationKeyStatus.Inactive;
        if (IsExpiredAt(now)) return RegistrationKeyStatus.Expired;
        if (IsParentKey && ParentId is not null) return RegistrationKeyStatus.Used;
        return RegistrationKeyStatus.Active;
    }

    // Whether the accounts that registered with this key may still sign in. A used key still admits its family.
    public RegistrationKeyProblem? AdmissionProblemAt(DateTime now)
    {
        if (!IsActive) return RegistrationKeyProblem.Inactive;
        if (IsExpiredAt(now)) return RegistrationKeyProblem.Expired;
        return null;
    }

    public bool IsExpiredAt(DateTime now) => ExpiresOn is { } expiresOn && expiresOn <= now;

    // A person registering themselves with this key: the role they get comes from here, never from the form.
    public void EnsureOpenForRegistration(DateTime now)
    {
        EnsureUsable(now);

        //insight - a parent key is spent by the first family that registers with it; a second parent reusing it would
        // share (and drain) the first family's children allowance
        if (IsParentKey && ParentId is not null)
            throw new DomainException("This registration key has already been used.");
    }

    // The parent who registered with (or was created on) this key becomes its owner. Idempotent for the same parent,
    // so an administrator re-running a half-finished creation does not fail.
    public void ClaimFor(User parent, IQuizMasterAction action)
    {
        if (!IsParentKey)
            throw new DomainException("Only a parent registration key can be claimed by a family.");
        if (!parent.IsParent)
            throw new DomainException("A registration key can only be claimed by a parent account.");
        if (parent.TenantId != TenantId)
            throw new DomainException("A registration key can only be claimed within its own organization.");
        if (ParentId == parent.Id)
            return;
        if (ParentId is not null)
            throw new DomainException("This registration key already belongs to another family.");

        ParentId = parent.Id;
        ClaimedOn = action.CreatedOn;
        Touch(action);
    }

    //insight - the count must rise in the same commit that creates the child: the child and the count are saved in one
    // transaction, and the rowversion on this row
    // makes two concurrent enrolments race on the count instead of both taking the last slot.
    public void SpendChildSlot(int parentId, DateTime now, IQuizMasterAction action)
    {
        EnsureChildSlotAvailable(parentId, now);

        ChildCount++;
        Touch(action);
    }

    // The same checks as SpendChildSlot, changing nothing: for a caller that must refuse before it creates a sign-in,
    // but can only spend the slot inside the transaction that saves the child.
    public void EnsureChildSlotAvailable(int parentId, DateTime now)
    {
        if (!IsParentKey || ParentId != parentId)
            throw new DomainException("A child can only be enrolled on their own family's registration key.");

        EnsureUsable(now);

        if (MaxChildren is { } maxChildren && ChildCount >= maxChildren)
            throw new DomainException($"This registration key allows {maxChildren} child account(s), and all are in use.");
    }

    // A child who leaves the family (moved to another parent, or no longer a student) gives their slot back.
    public void ReleaseChildSlot(IQuizMasterAction action)
    {
        if (ChildCount == 0)
            return;                                              // a count that drifted low stays at zero, never negative
        ChildCount--;
        Touch(action);
    }

    private void EnsureUsable(DateTime now)
    {
        switch (AdmissionProblemAt(now))
        {
            case RegistrationKeyProblem.Inactive: throw new DomainException("This registration key is inactive.");
            case RegistrationKeyProblem.Expired: throw new DomainException("This registration key has expired.");
        }
    }

    private void ApplyTerms(DateTime? expiresOn, int? maxChildren)
    {
        if (!IsParentKey && maxChildren is not null)
            throw new DomainException("Only a parent registration key has a children allowance.");
        if (maxChildren is < 0)
            throw new DomainException("The children allowance cannot be negative.");
        if (maxChildren is { } allowance && allowance < ChildCount)
            throw new DomainException($"This family already has {ChildCount} child account(s); the allowance cannot be lower.");

        (ExpiresOn, MaxChildren) = (expiresOn, maxChildren);
    }

    private void Touch(IQuizMasterAction action)
    {
        LastModifiedById = action.CreatedById;
        LastModifiedOn = action.CreatedOn;
    }
}
