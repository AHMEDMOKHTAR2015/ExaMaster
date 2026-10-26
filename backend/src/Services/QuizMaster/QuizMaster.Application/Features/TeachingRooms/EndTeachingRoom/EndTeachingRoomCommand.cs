namespace QuizMaster.Application.Features.TeachingRooms.EndTeachingRoom;

// The teacher ends a room: it is removed with its requests, and every page open on it hears so.
public record EndTeachingRoomCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.EndTeachingRoom;
}

public class EndTeachingRoomCommandValidator : QuizMasterCommandValidator<EndTeachingRoomCommand>;
