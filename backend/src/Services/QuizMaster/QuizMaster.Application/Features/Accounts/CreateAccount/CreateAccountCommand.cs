using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.Accounts.CreateAccount;

public enum NewAccountKind
{
    ApplicationAdmin = 1,
    Teacher = 2,
    Parent = 3,
    Student = 4,
}

// An administrator creating a sign-in and profile in their own organization (the app's Users admin "Add user").
// A parent claims the registration key it is created with; a student is enrolled on their parent's key.
public record CreateAccountCommand(
    NewAccountKind Kind,
    string FirstName,
    string LastName,
    string MobileNumber,
    string? Email,
    string Password,
    string? RegistrationKeyCode,
    int? ParentId,
    int? ClassId) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.CreateAccount;
}

public class CreateAccountCommandValidator : AbstractValidator<CreateAccountCommand>
{
    public CreateAccountCommandValidator()
    {
        RuleFor(c => c.Kind).IsInEnum();
        RuleFor(c => c.FirstName).NotEmptyWithMessage(nameof(CreateAccountCommand.FirstName)).MaximumLengthWithMessage(MaxLength.C128, nameof(CreateAccountCommand.FirstName));
        RuleFor(c => c.LastName).NotEmptyWithMessage(nameof(CreateAccountCommand.LastName)).MaximumLengthWithMessage(MaxLength.C128, nameof(CreateAccountCommand.LastName));
        RuleFor(c => c.MobileNumber).Must(SignInEmail.HasEnoughDigits).WithMessage(SignInEmail.MobileNumberMessage).MaximumLengthWithMessage(MaxLength.C32, nameof(CreateAccountCommand.MobileNumber));
        RuleFor(c => c.Email).EmailAddress().MaximumLengthWithMessage(MaxLength.C256, nameof(CreateAccountCommand.Email)).When(c => !string.IsNullOrWhiteSpace(c.Email));
        RuleFor(c => c.Password).MustBeAcceptablePassword();
        RuleFor(c => c.RegistrationKeyCode).MaximumLengthWithMessage(MaxLength.C64, nameof(CreateAccountCommand.RegistrationKeyCode));

        RuleFor(c => c.RegistrationKeyCode).NotEmpty().WithMessage("A parent account is created with the family's registration key.")
            .When(c => c.Kind == NewAccountKind.Parent);

        When(c => c.Kind == NewAccountKind.Student, () =>
        {
            RuleFor(c => c.ParentId).NotNull().GreaterThan(0).WithMessage("A student account needs a parent.");
            RuleFor(c => c.ClassId).NotNull().GreaterThan(0).WithMessage("A student account needs a class.");
            // a student is always charged to their parent's key; accepting another would let one family spend another's
            RuleFor(c => c.RegistrationKeyCode).Empty().WithMessage("A student is enrolled on their parent's registration key; do not name one.");
        });
    }
}
