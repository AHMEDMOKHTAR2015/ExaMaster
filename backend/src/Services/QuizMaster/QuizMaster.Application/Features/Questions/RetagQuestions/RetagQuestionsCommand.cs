using QuizMaster.Application.Features.Questions.Shared;

namespace QuizMaster.Application.Features.Questions.RetagQuestions;

// Adds and removes tags on many bank questions at once, keeping each question's other tags. The tags to add must all be
// of one subject, and every chosen question must be in it; removing a tag a question does not carry changes nothing.
// Ids that no longer exist are skipped.
public record RetagQuestionsCommand(List<int> QuestionIds, List<int>? AddTagIds, List<int>? RemoveTagIds)
    : QuizMasterCommand<RetagQuestionsResponse>
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.RetagQuestions;
}

public record RetagQuestionsResponse(int UpdatedCount);

public class RetagQuestionsCommandValidator : AbstractValidator<RetagQuestionsCommand>
{
    public RetagQuestionsCommandValidator()
    {
        RuleFor(c => c.QuestionIds).NotEmpty().Must(ids => ids.Count <= 1000).WithMessage("Retag at most 1000 questions at a time.");
        RuleFor(c => c).Must(c => c.AddTagIds is { Count: > 0 } || c.RemoveTagIds is { Count: > 0 })
            .WithMessage("Choose at least one tag to add or remove.").OverridePropertyName("addTagIds");
        this.AddQuestionTagRules(c => c.AddTagIds);
    }
}
