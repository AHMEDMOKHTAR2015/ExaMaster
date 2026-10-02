using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.Registration.Register;

// A person creating their own account with a registration key: a parent with their family's key, or a new school
// administrator with an administrator key. Anonymous: they have no account yet. The role and the organization both
// come from the key, never from the request.
public record RegisterCommand(string Code, string FirstName, string LastName, string MobileNumber, string Password)
    : QuizMasterCommand<RegistrationResponse>
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.Register;
}

public class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(c => c.Code).NotEmptyWithMessage(nameof(RegisterCommand.Code)).MaximumLengthWithMessage(MaxLength.C64, nameof(RegisterCommand.Code));
        RuleFor(c => c.FirstName).NotEmptyWithMessage(nameof(RegisterCommand.FirstName)).MaximumLengthWithMessage(MaxLength.C128, nameof(RegisterCommand.FirstName));
        RuleFor(c => c.LastName).NotEmptyWithMessage(nameof(RegisterCommand.LastName)).MaximumLengthWithMessage(MaxLength.C128, nameof(RegisterCommand.LastName));
        RuleFor(c => c.MobileNumber).Must(SignInEmail.HasEnoughDigits).WithMessage(SignInEmail.MobileNumberMessage).MaximumLengthWithMessage(MaxLength.C32, nameof(RegisterCommand.MobileNumber));
        RuleFor(c => c.Password).MustBeAcceptablePassword();
    }
}
