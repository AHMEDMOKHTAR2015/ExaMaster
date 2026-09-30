namespace QuizMaster.Application.Features.Academic.CreateTeacher;

// A teacher on the roster: listed and assigned to classes before (or without) signing in.
public record CreateTeacherCommand(string FirstName, string LastName, string? Email, string? PhotoUrl, List<int>? SubjectIds) : QuizMasterCommand
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
    }
}
