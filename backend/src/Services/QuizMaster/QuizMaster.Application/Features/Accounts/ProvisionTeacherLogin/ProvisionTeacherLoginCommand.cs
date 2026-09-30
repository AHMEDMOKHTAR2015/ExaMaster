using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.Accounts.ProvisionTeacherLogin;

public enum TeacherLoginStatus
{
    Created = 1,                 // a new sign-in with the given password
    Linked = 2,                  // an account of this organization with that email now carries the teacher role
    SkippedNoEmail = 3,          // the roster record has no email, so there is nothing to sign in with
    ExistsUnmanaged = 4,         // the email already signs in to an account that is not this organization's
}

public record TeacherLoginResponse(TeacherLoginStatus Status, int? UserId);

// Idempotently make sure a teacher on the roster can sign in ({id} = the Teacher record). Re-running it is safe.
public record ProvisionTeacherLoginCommand(string Password) : QuizMasterCommand<TeacherLoginResponse>
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.ProvisionTeacherLogin;
}

public class ProvisionTeacherLoginCommandValidator : QuizMasterCommandValidator<ProvisionTeacherLoginCommand>
{
    public ProvisionTeacherLoginCommandValidator()
    {
        RuleFor(c => c.Password).MinimumLength(SignInEmail.MinimumPasswordLength).WithMessage(SignInEmail.PasswordMessage).MaximumLength(MaxLength.C128);
    }
}
