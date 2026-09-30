namespace QuizMaster.Application.Features.Academic.CreateGrade;

// A grade level inside a stage.
public record CreateGradeCommand(int StageId, string Name, int Order) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.CreateGrade;
}

public class CreateGradeCommandValidator : AbstractValidator<CreateGradeCommand>
{
    public CreateGradeCommandValidator()
    {
        RuleFor(c => c.StageId).GreaterThan(0).WithMessageForInvalidId(nameof(CreateGradeCommand.StageId));
        RuleFor(c => c.Name).NotEmptyWithMessage(nameof(CreateGradeCommand.Name)).MaximumLengthWithMessage(MaxLength.C128, nameof(CreateGradeCommand.Name));
        RuleFor(c => c.Order).GreaterThanOrEqualTo(0);
    }
}
