namespace QuizMaster.Application.Features.Shared;

// Who is asking, for read paths that narrow what they return (a student sees their own history, a parent their child's).
// Write paths get the caller from the command itself (CreatedById, stamped by the pipeline).
public sealed record Caller(int UserId, IReadOnlySet<UserRoleType> Roles)
{
    public bool IsApplicationAdmin => Roles.Contains(UserRoleType.APPLICATION_ADMIN);
    public bool IsTeacher => Roles.Contains(UserRoleType.TEACHER);
    public bool IsStaff => IsApplicationAdmin || IsTeacher;
    public bool IsParent => Roles.Contains(UserRoleType.PARENT);

    public static Caller From(IClaimsProvider claims) => new(claims.GetUserId(), claims.GetUserRoles<UserRoleType>());
}
