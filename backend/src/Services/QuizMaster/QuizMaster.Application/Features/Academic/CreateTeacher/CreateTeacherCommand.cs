using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.Academic.CreateTeacher;

public record CreateTeacherResponse(int Id, TeacherLoginStatus LoginStatus, int? UserId);

// A teacher on the roster: listed and assigned to classes before (or without) signing in. With an email, their
// sign-in is created (Password) or their school account linked in the same commit; an email that signs in outside
// this school is refused (409) and no teacher is added.
public record CreateTeacherCommand(string FirstName, string LastName, string? Email, string? PhotoUrl, List<int>? SubjectIds, string? Password = null)
    : QuizMasterCommand<CreateTeacherResponse>
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.CreateTeacher;
}

public class CreateTeacherCommandValidator : AbstractValidator<CreateTeacherCommand>
{
    public CreateTeacherCommandValidator()
    {
        RuleFor(c => c.FirstName).NotEmptyWithMessage(nameof(CreateTeacherCommand.FirstName)).MaximumLengthWithMessage(MaxLength.C128, nameof(CreateTeacherCommand.FirstName));
        RuleFor(c => c.LastName).NotEmptyWithMessage(nameof(CreateTeacherCommand.LastName)).MaximumLengthWithMessage(MaxLength.C128, nameof(CreateTeacherCommand.LastName));
        RuleFor(c => c.Email).MaximumLengthWithMessage(MaxLength.C256, nameof(CreateTeacherCommand.Email));
        RuleFor(c => c.PhotoUrl).MaximumLengthWithMessage(MaxLength.C1024, nameof(CreateTeacherCommand.PhotoUrl));
        RuleFor(c => c.Password).MustBeAcceptablePassword().When(c => c.Password is not null);
    }
}
