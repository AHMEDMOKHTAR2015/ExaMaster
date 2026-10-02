using QuizMaster.Application.Features.Academic.Shared;

namespace QuizMaster.Application.Features.Academic.CreateSubject;

// A subject classes are taught (Math, Science, ...), with the topics (tags) its questions can be tagged with.
public record CreateSubjectCommand(string Name, string? Color, List<SubjectTagDraft>? Tags) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.CreateSubject;
}

public class CreateSubjectCommandValidator : AbstractValidator<CreateSubjectCommand>
{
    public CreateSubjectCommandValidator()
    {
        RuleFor(c => c.Name).NotEmptyWithMessage(nameof(CreateSubjectCommand.Name)).MaximumLengthWithMessage(MaxLength.C128, nameof(CreateSubjectCommand.Name));
        RuleFor(c => c.Color).MaximumLengthWithMessage(MaxLength.C16, nameof(CreateSubjectCommand.Color));
        this.AddSubjectTagRules(c => c.Tags);
    }
}
