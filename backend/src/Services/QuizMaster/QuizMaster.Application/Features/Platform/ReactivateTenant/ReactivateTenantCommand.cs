namespace QuizMaster.Application.Features.Platform.ReactivateTenant;

public record ReactivateTenantCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.ReactivateTenant;
}

public class ReactivateTenantCommandValidator : QuizMasterCommandValidator<ReactivateTenantCommand>;
