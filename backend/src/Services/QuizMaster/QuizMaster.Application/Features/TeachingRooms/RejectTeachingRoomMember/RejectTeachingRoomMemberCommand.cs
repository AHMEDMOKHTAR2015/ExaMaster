namespace QuizMaster.Application.Features.TeachingRooms.RejectTeachingRoomMember;

// The teacher turns a waiting student away, or removes an admitted one: every page they have open on the room leaves its
// board at once.
public record RejectTeachingRoomMemberCommand(int StudentId) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.RejectTeachingRoomMember;
}

public class RejectTeachingRoomMemberCommandValidator : QuizMasterCommandValidator<RejectTeachingRoomMemberCommand>
{
    public RejectTeachingRoomMemberCommandValidator()
        => RuleFor(c => c.StudentId).GreaterThan(0).WithMessageForInvalidId(nameof(RejectTeachingRoomMemberCommand.StudentId));
}
