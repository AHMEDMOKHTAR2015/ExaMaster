namespace QuizMaster.Application.Features.Academic.UpdateClass;

public record UpdateClassCommand(int GradeId, string Name, List<int>? TeacherIds, List<int>? SubjectIds) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.UpdateClass;
}

public class UpdateClassCommandValidator : QuizMasterCommandValidator<UpdateClassCommand>
{
    public UpdateClassCommandValidator()
    {
        RuleFor(c => c.GradeId).GreaterThan(0).WithMessageForInvalidId(nameof(UpdateClassCommand.GradeId));
        RuleFor(c => c.Name).NotEmptyWithMessage(nameof(UpdateClassCommand.Name)).MaximumLengthWithMessage(MaxLength.C128, nameof(UpdateClassCommand.Name));
    }
}
