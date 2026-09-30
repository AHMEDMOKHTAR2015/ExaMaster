namespace QuizMaster.Application.Dtos;

public record RegistrationKeyDto(
    int Id,
    string Code,
    UserRoleType Role,
    bool IsActive,
    DateTime? ExpiresOn,
    RegistrationKeyStatus Status,
    int? ParentId,
    DateTime? ClaimedOn,
    int? MaxChildren,
    int ChildCount,
    DateTime CreatedOn)
{
    // Status depends on the clock, so it is computed at read time rather than mapped.
    public static RegistrationKeyDto From(RegistrationKey key, DateTime now) => new(
        key.Id, key.Code, key.Role, key.IsActive, key.ExpiresOn, key.StatusAt(now),
        key.ParentId, key.ClaimedOn, key.MaxChildren, key.ChildCount, key.CreatedOn);
}

// What a self-registration returns: the email to sign in with (a mobile number becomes {digits}@mobile.local).
public record RegistrationResponse(int UserId, string Email);
