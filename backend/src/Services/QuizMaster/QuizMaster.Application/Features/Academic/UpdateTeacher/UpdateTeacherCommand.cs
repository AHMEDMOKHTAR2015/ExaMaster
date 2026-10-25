using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.Academic.UpdateTeacher;

public record UpdateTeacherResponse(int Id, TeacherLoginStatus LoginStatus, int? UserId);

// With an email, the teacher's sign-in is created (Password) or their school account linked as the record is saved;
// an email that signs in outside this school is refused (409) and the record is left as it was.
public record UpdateTeacherCommand(string FirstName, string LastName, string? Email, string? PhotoUrl, List<int>? SubjectIds, string? Password = null)
    : QuizMasterCommand<UpdateTeacherResponse>
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.UpdateTeacher;
}

public class UpdateTeacherCommandValidator : QuizMasterCommandValidator<UpdateTeacherCommand>
{
    public UpdateTeacherCommandValidator()
    {
        RuleFor(c => c.FirstName).NotEmptyWithMessage(nameof(UpdateTeacherCommand.FirstName)).MaximumLengthWithMessage(MaxLength.C128, nameof(UpdateTeacherCommand.FirstName));
        RuleFor(c => c.LastName).NotEmptyWithMessage(nameof(UpdateTeacherCommand.LastName)).MaximumLengthWithMessage(MaxLength.C128, nameof(UpdateTeacherCommand.LastName));
        RuleFor(c => c.Email).MaximumLengthWithMessage(MaxLength.C256, nameof(UpdateTeacherCommand.Email));
        RuleFor(c => c.PhotoUrl).MaximumLengthWithMessage(MaxLength.C1024, nameof(UpdateTeacherCommand.PhotoUrl));
        RuleFor(c => c.Password).MustBeAcceptablePassword().When(c => c.Password is not null);
    }
}
