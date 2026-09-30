namespace QuizMaster.Application.Features.Academic.UpdateTeacher;

public record UpdateTeacherCommand(string FirstName, string LastName, string? Email, string? PhotoUrl, List<int>? SubjectIds) : QuizMasterCommand
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
    }
}
