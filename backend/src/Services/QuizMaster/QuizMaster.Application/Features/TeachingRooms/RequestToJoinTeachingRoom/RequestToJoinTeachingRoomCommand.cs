namespace QuizMaster.Application.Features.TeachingRooms.RequestToJoinTeachingRoom;

// A student of a class the room's material reaches asks to join; the teacher's open pages on the room hear of it.
// Asking again changes nothing (a decision stands until the teacher changes it).
public record RequestToJoinTeachingRoomCommand : QuizMasterCommand<RequestToJoinTeachingRoomResponse>
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.RequestToJoinTeachingRoom;
}

public record RequestToJoinTeachingRoomResponse(TeachingRoomAdmission Admission);

public class RequestToJoinTeachingRoomCommandValidator : QuizMasterCommandValidator<RequestToJoinTeachingRoomCommand>;
