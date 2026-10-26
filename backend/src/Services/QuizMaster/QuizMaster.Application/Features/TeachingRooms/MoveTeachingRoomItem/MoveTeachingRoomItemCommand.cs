namespace QuizMaster.Application.Features.TeachingRooms.MoveTeachingRoomItem;

public enum TeachingRoomMove
{
    Next,
    Previous,
}

// The teacher moves the board one item on or back; every admitted screen follows. Past either end is refused (400).
public record MoveTeachingRoomItemCommand(TeachingRoomMove Move) : QuizMasterCommand<MoveTeachingRoomItemResponse>
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.MoveTeachingRoomItem;
}

public record MoveTeachingRoomItemResponse(TeachingRoomStateDto State);

public class MoveTeachingRoomItemCommandValidator : QuizMasterCommandValidator<MoveTeachingRoomItemCommand>
{
    public MoveTeachingRoomItemCommandValidator()
        => RuleFor(c => c.Move).IsInEnum();
}
