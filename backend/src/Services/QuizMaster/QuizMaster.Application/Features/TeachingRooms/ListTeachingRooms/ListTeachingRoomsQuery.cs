namespace QuizMaster.Application.Features.TeachingRooms.ListTeachingRooms;

// A teacher lists the rooms they opened; a student, the rooms whose material reaches their class and those they asked to
// join, each with where they stand. Worked out from the caller's own records, never from ids the client sends.
public record ListTeachingRoomsQuery : IQuery<ListTeachingRoomsResponse>;
public record ListTeachingRoomsResponse(IReadOnlyList<TeachingRoomSummaryDto> Rooms);
