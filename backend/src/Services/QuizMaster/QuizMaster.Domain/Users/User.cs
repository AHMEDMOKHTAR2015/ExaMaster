namespace QuizMaster.Domain.Users;

// A person who signs in. The password is their sign-in credential's (SignInCredential); this is the profile
// that decides what they may do: their roles and their organization, read on every request.
public partial class User : AggregateRoot, IMultitenancy
{
    private User() {}                                            // use User.Create(...)

    public int TenantId { get; set; }

    // Which sign-in is this person's: the Uid of their SignInCredential, and the "sub" claim of their access token.
    // Never shown to anyone; the app refers to a person by Id.
    public required string SignInUid { get; init; }

    public string Email { get; private set; } = null!;
    public string DisplayName { get; private set; } = null!;
    public string? FirstName { get; private set; }
    public string? LastName { get; private set; }
    public string? MobileNumber { get; private set; }
    public string? PhotoUrl { get; private set; }

    public IReadOnlyList<UserRoleType> Roles { get; private set; } = [];   // changed only by AssignRoles
    public bool IsActive { get; private set; }

    public int? ParentId { get; private set; }                   // a student's parent account
    public int? TeacherId { get; private set; }                  // a teacher's roster record (academic Teacher)

    // The key this account registered with; a child holds their family's. Re-checked on every request: a lapsed key
    // suspends the account (UserClaimsTransformation), as the app's admitCurrentUser did at sign-in.
    public int? RegistrationKeyId { get; private set; }

    // A student's placement, snapshotted onto every submission.
    public int? StageId { get; private set; }
    public int? GradeId { get; private set; }
    public int? ClassId { get; private set; }

    // When they last used the app: their latest sign-in or session renewal (the app renews about every 30 minutes while
    // it is open). Null until they first sign in. Written by SignInSessions straight to the column, so being active is
    // never recorded as an edit of the account.
    public DateTime? LastActiveOn { get; private set; }

    public bool IsStudent => Roles.Contains(UserRoleType.STUDENT);
    public bool IsTeacher => Roles.Contains(UserRoleType.TEACHER);
    public bool IsParent => Roles.Contains(UserRoleType.PARENT);
    public bool IsApplicationAdmin => Roles.Contains(UserRoleType.APPLICATION_ADMIN);
    public bool IsStaff => IsTeacher || IsApplicationAdmin;
}
