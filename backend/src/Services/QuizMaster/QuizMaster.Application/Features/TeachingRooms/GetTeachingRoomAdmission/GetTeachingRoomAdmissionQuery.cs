namespace QuizMaster.Application.Features.TeachingRooms.GetTeachingRoomAdmission;

// Where the caller stands in a room, for the hub's JoinRoom: only an admitted caller's connection joins the room's group.
// No such room (or another organization's) is None, never an error, so a refused join reveals nothing.
public record GetTeachingRoomAdmissionQuery(int Id) : IQuery<GetTeachingRoomAdmissionResponse>;
public record GetTeachingRoomAdmissionResponse(TeachingRoomAdmission Admission);
