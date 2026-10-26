namespace QuizMaster.Application.Features.TeachingRooms.CreateTeachingRoom;

// A teacher opens a live board on material they uploaded; the room is for that material's subject.
public record CreateTeachingRoomCommand(int TeachingMaterialId) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.CreateTeachingRoom;
}

public class CreateTeachingRoomCommandValidator : AbstractValidator<CreateTeachingRoomCommand>
{
    public CreateTeachingRoomCommandValidator()
        => RuleFor(c => c.TeachingMaterialId).GreaterThan(0).WithMessageForInvalidId(nameof(CreateTeachingRoomCommand.TeachingMaterialId));
}
