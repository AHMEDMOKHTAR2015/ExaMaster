namespace QuizMaster.Application.Dtos;

// Where the caller stands in a room. Only Teacher and Approved are admitted to the board: its live group and its state.
public enum TeachingRoomAdmission
{
    None,           // not theirs to see: another teacher's room, a class the material does not reach, or no such room
    MayRequest,     // a student of a class the material reaches, who has not asked yet
    Pending,
    Rejected,
    Approved,
    Teacher,        // the teacher presenting it
}

// A room as a list shows it, with the caller's own standing in it. No content.
public record TeachingRoomSummaryDto(
    int Id,
    int SubjectId,
    int TeachingMaterialId,
    string MaterialTitle,
    string? TeacherName,
    int ItemCount,
    DateTime CreatedOn,
    TeachingRoomAdmission Admission);

// A room as its page opens it. Members are the teacher's alone (null for a student); the board itself comes only as
// TeachingRoomStateDto, to the admitted.
public record TeachingRoomDto(
    int Id,
    int SubjectId,
    int TeachingMaterialId,
    string MaterialTitle,
    string? TeacherName,
    int ItemCount,
    DateTime CreatedOn,
    TeachingRoomAdmission Admission,
    IReadOnlyList<TeachingRoomMemberDto>? Members);

public record TeachingRoomMemberDto(
    int StudentId,
    string StudentName,
    string? ClassName,
    TeachingRoomMemberStatus Status,
    DateTime RequestedOn,
    DateTime? DecidedOn);

// What every admitted screen shows: the item the teacher is on. Revision orders states that arrive out of order.
public record TeachingRoomStateDto(
    int RoomId,
    int Position,
    int ItemCount,
    bool CanGoPrevious,
    bool CanGoNext,
    int Revision,
    TeachingRoomItemDto Item);

// One lesson of the material, with the unit it belongs to; the unit's last lesson closes with its key takeaways.
public record TeachingRoomItemDto(
    int UnitNumber,
    string UnitKind,
    string UnitTitle,
    IReadOnlyList<string> KeyTakeaways,
    bool ClosesUnit,
    MaterialLessonDto Lesson);

// The hub's answer to JoinRoom: the state only when the caller was admitted to the room's group.
public record JoinTeachingRoomResult(TeachingRoomAdmission Admission, TeachingRoomStateDto? State);
