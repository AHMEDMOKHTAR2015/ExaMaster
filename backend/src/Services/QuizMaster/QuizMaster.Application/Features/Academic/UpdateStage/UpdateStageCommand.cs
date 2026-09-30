namespace QuizMaster.Application.Features.Academic.UpdateStage;

public record UpdateStageCommand(string Name, int Order) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.UpdateStage;
}

public class UpdateStageCommandValidator : QuizMasterCommandValidator<UpdateStageCommand>
{
    public UpdateStageCommandValidator()
    {
        RuleFor(c => c.Name).NotEmptyWithMessage(nameof(UpdateStageCommand.Name)).MaximumLengthWithMessage(MaxLength.C128, nameof(UpdateStageCommand.Name));
        RuleFor(c => c.Order).GreaterThanOrEqualTo(0);
    }
}
