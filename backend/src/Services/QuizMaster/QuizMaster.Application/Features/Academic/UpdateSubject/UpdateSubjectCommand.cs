namespace QuizMaster.Application.Features.Academic.UpdateSubject;

public record UpdateSubjectCommand(string Name, string? Color) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.UpdateSubject;
}

public class UpdateSubjectCommandValidator : QuizMasterCommandValidator<UpdateSubjectCommand>
{
    public UpdateSubjectCommandValidator()
    {
        RuleFor(c => c.Name).NotEmptyWithMessage(nameof(UpdateSubjectCommand.Name)).MaximumLengthWithMessage(MaxLength.C128, nameof(UpdateSubjectCommand.Name));
        RuleFor(c => c.Color).MaximumLengthWithMessage(MaxLength.C16, nameof(UpdateSubjectCommand.Color));
    }
}
