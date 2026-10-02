using QuizMaster.Application.Features.Questions.Shared;

namespace QuizMaster.Application.Features.Questions.TagQuestion;

// Replaces one bank question's tags (tags of its own subject), leaving its content, answer and classification as they are.
public record TagQuestionCommand(List<int> TagIds) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.TagQuestion;
}

public class TagQuestionCommandValidator : QuizMasterCommandValidator<TagQuestionCommand>
{
    public TagQuestionCommandValidator()
    {
        RuleFor(c => c.TagIds).NotNull();
        this.AddQuestionTagRules(c => c.TagIds);
    }
}
