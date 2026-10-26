namespace QuizMaster.Application.Features.TeachingRooms.ApproveTeachingRoomMember;

// The teacher admits a waiting student, or one turned away earlier: every page they have open on the room joins its board.
public record ApproveTeachingRoomMemberCommand(int StudentId) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.ApproveTeachingRoomMember;
}

public class ApproveTeachingRoomMemberCommandValidator : QuizMasterCommandValidator<ApproveTeachingRoomMemberCommand>
{
    public ApproveTeachingRoomMemberCommandValidator()
        => RuleFor(c => c.StudentId).GreaterThan(0).WithMessageForInvalidId(nameof(ApproveTeachingRoomMemberCommand.StudentId));
}
