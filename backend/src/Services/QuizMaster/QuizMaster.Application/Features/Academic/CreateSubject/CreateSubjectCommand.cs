namespace QuizMaster.Application.Features.Academic.CreateSubject;

// A subject classes are taught (Math, Science, ...).
public record CreateSubjectCommand(string Name, string? Color) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.CreateSubject;
}

public class CreateSubjectCommandValidator : AbstractValidator<CreateSubjectCommand>
{
    public CreateSubjectCommandValidator()
    {
        RuleFor(c => c.Name).NotEmptyWithMessage(nameof(CreateSubjectCommand.Name)).MaximumLengthWithMessage(MaxLength.C128, nameof(CreateSubjectCommand.Name));
        RuleFor(c => c.Color).MaximumLengthWithMessage(MaxLength.C16, nameof(CreateSubjectCommand.Color));
    }
}
