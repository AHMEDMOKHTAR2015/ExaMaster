namespace QuizMaster.Application.Features.Platform.SuspendTenant;

// Every member loses every role on their next request; nothing is deleted.
public record SuspendTenantCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.SuspendTenant;
}

public class SuspendTenantCommandValidator : QuizMasterCommandValidator<SuspendTenantCommand>;
