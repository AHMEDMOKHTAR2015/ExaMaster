using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.AccessRequests.SubmitAccessRequest;

// A visitor with no registration key asking to join, as a parent or as a child. Anonymous: they have no account yet.
// Nothing is created but the request; the platform administrator decides which organization (and, for a child, which
// class and parent) it becomes an account in.
public record SubmitAccessRequestCommand(
    AccessRequestKind Kind,
    string FirstName,
    string LastName,
    string MobileNumber,
    string Password,
    string? Email = null,
    string? SchoolName = null,
    string? GradeName = null,
    string? ParentName = null,
    string? ParentMobileNumber = null,
    string? Note = null) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.SubmitAccessRequest;
}

public class SubmitAccessRequestCommandValidator : AbstractValidator<SubmitAccessRequestCommand>
{
    public SubmitAccessRequestCommandValidator()
    {
        RuleFor(c => c.Kind).IsInEnum();
        RuleFor(c => c.FirstName).NotEmptyWithMessage(nameof(SubmitAccessRequestCommand.FirstName)).MaximumLengthWithMessage(MaxLength.C128, nameof(SubmitAccessRequestCommand.FirstName));
        RuleFor(c => c.LastName).NotEmptyWithMessage(nameof(SubmitAccessRequestCommand.LastName)).MaximumLengthWithMessage(MaxLength.C128, nameof(SubmitAccessRequestCommand.LastName));
        RuleFor(c => c.MobileNumber).Must(SignInEmail.HasEnoughDigits).WithMessage(SignInEmail.MobileNumberMessage).MaximumLengthWithMessage(MaxLength.C32, nameof(SubmitAccessRequestCommand.MobileNumber));
        RuleFor(c => c.Password).MinimumLength(SignInEmail.MinimumPasswordLength).WithMessage(SignInEmail.PasswordMessage).MaximumLength(MaxLength.C128);

        RuleFor(c => c.Email).EmailAddress().MaximumLengthWithMessage(MaxLength.C256, nameof(SubmitAccessRequestCommand.Email))
            .When(c => !string.IsNullOrWhiteSpace(c.Email));
        RuleFor(c => c.Email).Empty().WithMessage("A child's request carries no email.")
            .When(c => c.Kind == AccessRequestKind.Child);
        RuleFor(c => c.SchoolName).MaximumLengthWithMessage(MaxLength.C128, nameof(SubmitAccessRequestCommand.SchoolName));
        RuleFor(c => c.Note).MaximumLengthWithMessage(MaxLength.C1024, nameof(SubmitAccessRequestCommand.Note));

        RuleFor(c => c.GradeName).MaximumLengthWithMessage(MaxLength.C128, nameof(SubmitAccessRequestCommand.GradeName));
        RuleFor(c => c.ParentName).MaximumLengthWithMessage(MaxLength.C256, nameof(SubmitAccessRequestCommand.ParentName));
        RuleFor(c => c.ParentMobileNumber).MaximumLengthWithMessage(MaxLength.C32, nameof(SubmitAccessRequestCommand.ParentMobileNumber));
        RuleFor(c => new { c.GradeName, c.ParentName, c.ParentMobileNumber })
            .Must(hints => string.IsNullOrWhiteSpace(hints.GradeName) && string.IsNullOrWhiteSpace(hints.ParentName) && string.IsNullOrWhiteSpace(hints.ParentMobileNumber))
            .WithMessage("Only a child's request names a grade or a parent.")
            .When(c => c.Kind == AccessRequestKind.Parent);
    }
}
