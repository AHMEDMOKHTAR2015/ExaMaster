using QuizMaster.Application.Features.Academic.Shared;

namespace QuizMaster.Application.Features.Academic.UpdateSubject;

// Tags is the subject's whole tag list: an entry with an Id keeps (and may rename) that tag, one without adds a tag,
// and a tag left out is removed from the subject and from every question tagged with it. Null leaves the tags as they are.
public record UpdateSubjectCommand(string Name, string? Color, List<SubjectTagDraft>? Tags) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.UpdateSubject;
}

public class UpdateSubjectCommandValidator : QuizMasterCommandValidator<UpdateSubjectCommand>
{
    public UpdateSubjectCommandValidator()
    {
        RuleFor(c => c.Name).NotEmptyWithMessage(nameof(UpdateSubjectCommand.Name)).MaximumLengthWithMessage(MaxLength.C128, nameof(UpdateSubjectCommand.Name));
        RuleFor(c => c.Color).MaximumLengthWithMessage(MaxLength.C16, nameof(UpdateSubjectCommand.Color));
        this.AddSubjectTagRules(c => c.Tags);
    }
}
