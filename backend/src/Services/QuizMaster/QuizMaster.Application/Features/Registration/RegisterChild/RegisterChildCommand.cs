using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.Registration.RegisterChild;

// A child creating their own student account with their parent's registration key (the app's first-login flow).
// Anonymous. The child joins the key's organization, is linked to the parent who claimed the key, and spends one of
// that family's child slots.
public record RegisterChildCommand(string Code, string FirstName, string LastName, string MobileNumber, string Password, int ClassId)
    : QuizMasterCommand<RegistrationResponse>
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.RegisterChild;
}

public class RegisterChildCommandValidator : AbstractValidator<RegisterChildCommand>
{
    public RegisterChildCommandValidator()
    {
        RuleFor(c => c.Code).NotEmptyWithMessage(nameof(RegisterChildCommand.Code)).MaximumLengthWithMessage(MaxLength.C64, nameof(RegisterChildCommand.Code));
        RuleFor(c => c.FirstName).NotEmptyWithMessage(nameof(RegisterChildCommand.FirstName)).MaximumLengthWithMessage(MaxLength.C128, nameof(RegisterChildCommand.FirstName));
        RuleFor(c => c.LastName).NotEmptyWithMessage(nameof(RegisterChildCommand.LastName)).MaximumLengthWithMessage(MaxLength.C128, nameof(RegisterChildCommand.LastName));
        RuleFor(c => c.MobileNumber).Must(SignInEmail.HasEnoughDigits).WithMessage(SignInEmail.MobileNumberMessage).MaximumLengthWithMessage(MaxLength.C32, nameof(RegisterChildCommand.MobileNumber));
        RuleFor(c => c.Password).MustBeAcceptablePassword();
        RuleFor(c => c.ClassId).GreaterThan(0).WithMessageForInvalidId(nameof(RegisterChildCommand.ClassId));
    }
}
