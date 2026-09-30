namespace QuizMaster.Application.Dtos;

public record TenantDto(int Id, string Slug, string Name, bool IsActive, TenantPlan Plan, string? LogoUrl, string? PrimaryColor, DateTime CreatedOn);

public record UserDto(
    int Id,
    string SignInUid,
    string Email,
    string DisplayName,
    string? FirstName,
    string? LastName,
    string? MobileNumber,
    string? PhotoUrl,
    IReadOnlyList<UserRoleType> Roles,
    bool IsActive,
    int? ParentId,
    int? TeacherId,
    int? StageId,
    int? GradeId,
    int? ClassId,
    int? RegistrationKeyId,
    DateTime CreatedOn,
    DateTime? LastActiveOn,
    int? ChildCount = null,                                      // filled by the users list only: how many children link to this account
    int? ParticipationCount = null);                             // filled by the users list only: how many attempts it has submitted
