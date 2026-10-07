namespace QuizMaster.Application.Dtos;

// Never carries the password hash: the reviewer has no use for it, and it is the visitor's future credential.
public record AccessRequestDto(
    int Id,
    AccessRequestKind Kind,
    string FirstName,
    string LastName,
    string MobileNumber,
    string? ContactEmail,
    int? ChildrenCount,                     // a parent's: how many children they want to follow
    string SchoolName,
    string? GradeName,
    string? ParentName,
    string? ParentMobileNumber,
    string? Note,
    AccessRequestStatus Status,
    DateTime CreatedOn,
    DateTime? DecidedOn,
    string? RejectionReason,
    int? ApprovedTenantId,
    string? ApprovedTenantName,
    int? ApprovedUserId);

// What the reviewer picks from when approving a child: a class of the chosen organization, named in full.
public record TenantClassOptionDto(int Id, string Name, int GradeId, string GradeName, int StageId, string StageName);

// A parent of the chosen organization, with what is left on their family key (approving a child spends one slot).
public record TenantParentOptionDto(int Id, string DisplayName, string? MobileNumber, int ChildCount, int? MaxChildren, bool HasUsableKey);
