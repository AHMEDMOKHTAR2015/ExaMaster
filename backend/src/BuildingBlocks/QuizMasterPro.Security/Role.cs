using QuizMasterPro.Abstractions.Enums;

namespace QuizMasterPro.Security;

// String constants for [Authorize(Roles = …)] and RequireRoleAuthorization(…), derived from the closed enum.
public static class Role
{
    public const string PlatformAdmin = nameof(UserRoleType.PLATFORM_ADMIN);
    public const string ApplicationAdmin = nameof(UserRoleType.APPLICATION_ADMIN);

    public const string Teacher = nameof(UserRoleType.TEACHER);
    public const string Student = nameof(UserRoleType.STUDENT);
    public const string Parent = nameof(UserRoleType.PARENT);

    // Staff: application admins and teachers.
    public static readonly string[] Staff = [ApplicationAdmin, Teacher];

    // Every tenant member: anyone signed in to this organization.
    public static readonly string[] Member = [ApplicationAdmin, Teacher, Student, Parent];
}
