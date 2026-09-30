using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.Accounts.AddMyChild;

// A parent enrolling one of their own children: a student account in their organization, linked to them, paid for by
// one slot of their registration key.
public record AddMyChildCommand(string FirstName, string LastName, string MobileNumber, string Password, int ClassId)
    : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.AddChild;
}

public class AddMyChildCommandValidator : AbstractValidator<AddMyChildCommand>
{
    public AddMyChildCommandValidator()
    {
        RuleFor(c => c.FirstName).NotEmptyWithMessage(nameof(AddMyChildCommand.FirstName)).MaximumLengthWithMessage(MaxLength.C128, nameof(AddMyChildCommand.FirstName));
        RuleFor(c => c.LastName).NotEmptyWithMessage(nameof(AddMyChildCommand.LastName)).MaximumLengthWithMessage(MaxLength.C128, nameof(AddMyChildCommand.LastName));
        RuleFor(c => c.MobileNumber).Must(SignInEmail.HasEnoughDigits).WithMessage(SignInEmail.MobileNumberMessage).MaximumLengthWithMessage(MaxLength.C32, nameof(AddMyChildCommand.MobileNumber));
        RuleFor(c => c.Password).MinimumLength(SignInEmail.MinimumPasswordLength).WithMessage(SignInEmail.PasswordMessage).MaximumLength(MaxLength.C128);
        RuleFor(c => c.ClassId).GreaterThan(0).WithMessageForInvalidId(nameof(AddMyChildCommand.ClassId));
    }
}
