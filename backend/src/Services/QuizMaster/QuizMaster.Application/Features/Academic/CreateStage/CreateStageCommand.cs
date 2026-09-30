namespace QuizMaster.Application.Features.Academic.CreateStage;

// An educational stage (Primary, Preparatory, ...): the top of the school hierarchy.
public record CreateStageCommand(string Name, int Order) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.CreateStage;
}

public class CreateStageCommandValidator : AbstractValidator<CreateStageCommand>
{
    public CreateStageCommandValidator()
    {
        RuleFor(c => c.Name).NotEmptyWithMessage(nameof(CreateStageCommand.Name)).MaximumLengthWithMessage(MaxLength.C128, nameof(CreateStageCommand.Name));
        RuleFor(c => c.Order).GreaterThanOrEqualTo(0);
    }
}
