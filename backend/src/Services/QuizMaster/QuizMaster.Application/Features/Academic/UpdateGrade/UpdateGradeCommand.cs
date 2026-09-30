namespace QuizMaster.Application.Features.Academic.UpdateGrade;

public record UpdateGradeCommand(int StageId, string Name, int Order) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.UpdateGrade;
}

public class UpdateGradeCommandValidator : QuizMasterCommandValidator<UpdateGradeCommand>
{
    public UpdateGradeCommandValidator()
    {
        RuleFor(c => c.StageId).GreaterThan(0).WithMessageForInvalidId(nameof(UpdateGradeCommand.StageId));
        RuleFor(c => c.Name).NotEmptyWithMessage(nameof(UpdateGradeCommand.Name)).MaximumLengthWithMessage(MaxLength.C128, nameof(UpdateGradeCommand.Name));
        RuleFor(c => c.Order).GreaterThanOrEqualTo(0);
    }
}
