namespace QuizMaster.Domain.Users;

public partial class User
{
    // The roles a tenant's own administrator may hand out. PLATFORM_ADMIN is the vendor's and belongs to no tenant.
    private static readonly UserRoleType[] TenantRoles =
        [UserRoleType.APPLICATION_ADMIN, UserRoleType.TEACHER, UserRoleType.STUDENT, UserRoleType.PARENT];

    public static User Create(
        int tenantId, string signInUid, string email, string displayName, IEnumerable<UserRoleType> roles, IQuizMasterAction action,
        string? firstName = null, string? lastName = null, string? mobileNumber = null, string? photoUrl = null)
    {
        Guard.ThrowIfNullOrWhiteSpace(signInUid);
        Guard.ThrowIfNullOrWhiteSpace(email);

        var validRoles = ValidateRoles(roles);
        if (validRoles.Contains(UserRoleType.PLATFORM_ADMIN) != (tenantId == 0))
            throw new DomainException("A platform administrator belongs to no tenant, and every other account belongs to one.");

        return new User
        {
            TenantId = tenantId,
            SignInUid = signInUid.Trim(),
            Email = email.Trim().ToLowerInvariant(),
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? email.Trim() : displayName.Trim(),
            FirstName = firstName?.Trim(),
            LastName = lastName?.Trim(),
            MobileNumber = mobileNumber?.Trim(),
            PhotoUrl = photoUrl?.Trim(),
            Roles = validRoles,
            IsActive = true,
            CreatedById = action.CreatedById,
            CreatedOn = action.CreatedOn
        };
    }

    public void AssignRoles(IEnumerable<UserRoleType> roles, IQuizMasterAction action)
    {
        var validRoles = ValidateRoles(roles);

        if (validRoles.Any(role => !TenantRoles.Contains(role)))
            throw new DomainException("Only tenant roles can be assigned: APPLICATION_ADMIN, TEACHER, STUDENT, PARENT.");

        //insight - an administrator removing their own admin role could leave the organization with nobody to manage it
        if (Id == action.CreatedById && IsApplicationAdmin && !validRoles.Contains(UserRoleType.APPLICATION_ADMIN))
            throw new DomainException("You cannot remove your own administrator role.");

        if (!validRoles.Contains(UserRoleType.STUDENT))
            (StageId, GradeId, ClassId) = (null, null, null);   // placement only means something for a student

        Roles = validRoles;
        Touch(action);
    }

    // Stage and grade come from the class, so a student's placement can never be self-contradictory.
    public void PlaceInClass(ClassGroup classGroup, IQuizMasterAction action)
    {
        if (!IsStudent)
            throw new DomainException("Only a student can be placed in a class.");

        (StageId, GradeId, ClassId) = (classGroup.StageId, classGroup.GradeId, classGroup.Id);
        Touch(action);
    }

    public void LinkToParent(User parent, IQuizMasterAction action)
    {
        if (!IsStudent)
            throw new DomainException("Only a student account can be linked to a parent.");
        if (!parent.IsParent)
            throw new DomainException("The parent account must hold the PARENT role.");

        ParentId = parent.Id;
        Touch(action);
    }

    public void LinkToTeacherRecord(Teacher teacher, IQuizMasterAction action)
    {
        if (!IsTeacher)
            throw new DomainException("Only a teacher account can be linked to a teacher record.");

        TeacherId = teacher.Id;
        Touch(action);
    }

    public void HoldRegistrationKey(RegistrationKey key, IQuizMasterAction action)
    {
        if (key.TenantId != TenantId)
            throw new DomainException("An account can only hold a registration key of its own organization.");
        if (key.IsParentKey && !IsParent && !IsStudent)
            throw new DomainException("A parent registration key is held by a parent and their children.");
        //insight - and the other way round: a family on an administrator key would have no allowance, and its children no
        // family subscription to be charged to
        if (!key.IsParentKey && (IsParent || IsStudent))
            throw new DomainException("A parent or child account needs a family (parent) registration key, not an administrator key.");

        RegistrationKeyId = key.Id;
        Touch(action);
    }

    public void ReleaseRegistrationKey(IQuizMasterAction action)
    {
        RegistrationKeyId = null;
        Touch(action);
    }

    // The email and password are the sign-in's (SignInCredential); the name shown in the app is the profile's.
    public void Rename(string firstName, string lastName, IQuizMasterAction action)
    {
        Guard.ThrowIfNullOrWhiteSpace(firstName);
        Guard.ThrowIfNullOrWhiteSpace(lastName);
        (FirstName, LastName) = (firstName.Trim(), lastName.Trim());
        DisplayName = $"{FirstName} {LastName}";
        Touch(action);
    }

    public void Deactivate(IQuizMasterAction action)
    {
        if (Id == action.CreatedById)
            throw new DomainException("You cannot deactivate your own account.");

        IsActive = false;
        Touch(action);
    }

    public void Activate(IQuizMasterAction action)
    {
        IsActive = true;
        Touch(action);
    }

    private static IReadOnlyList<UserRoleType> ValidateRoles(IEnumerable<UserRoleType> roles)
    {
        var distinct = roles.Distinct().OrderBy(role => role).ToList();

        if (distinct.Any(role => !Enum.IsDefined(role)))
            throw new DomainException("Unknown role.");

        //insight - a student account is a child's: it must never also carry staff or parent powers
        if (distinct.Contains(UserRoleType.STUDENT) && distinct.Count > 1)
            throw new DomainException("A student account cannot hold any other role.");

        return distinct;
    }

    private void Touch(IQuizMasterAction action)
    {
        LastModifiedById = action.CreatedById;
        LastModifiedOn = action.CreatedOn;
    }
}
