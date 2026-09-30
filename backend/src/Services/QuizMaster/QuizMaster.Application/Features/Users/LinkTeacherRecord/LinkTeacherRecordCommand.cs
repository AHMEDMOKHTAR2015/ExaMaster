namespace QuizMaster.Application.Features.Users.LinkTeacherRecord;

// Links a teacher's sign-in to their roster record, which is what classes list as their teachers.
public record LinkTeacherRecordCommand(int TeacherId) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.LinkTeacherRecord;
}

public class LinkTeacherRecordCommandValidator : QuizMasterCommandValidator<LinkTeacherRecordCommand>
{
    public LinkTeacherRecordCommandValidator()
        => RuleFor(c => c.TeacherId).GreaterThan(0).WithMessageForInvalidId(nameof(LinkTeacherRecordCommand.TeacherId));
}
