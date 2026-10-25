using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.Accounts.ProvisionTeacherLogin;

// Idempotently make sure a teacher on the roster can sign in ({id} = the Teacher record). Re-running it is safe.
public record ProvisionTeacherLoginCommand(string Password) : QuizMasterCommand<TeacherLoginResponse>
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.ProvisionTeacherLogin;
}

public class ProvisionTeacherLoginCommandValidator : QuizMasterCommandValidator<ProvisionTeacherLoginCommand>
{
    public ProvisionTeacherLoginCommandValidator()
    {
        RuleFor(c => c.Password).MustBeAcceptablePassword();
    }
}
