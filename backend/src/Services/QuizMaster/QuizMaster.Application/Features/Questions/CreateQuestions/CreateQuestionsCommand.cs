using QuizMaster.Application.Features.Questions.Shared;

namespace QuizMaster.Application.Features.Questions.CreateQuestions;

// Many new bank questions at once (the bank's JSON upload): all of them, or none. The first invalid one is reported
// by its position ("Question 7: …") and nothing is saved, so a half-uploaded file never has to be cleaned up by hand.
public record CreateQuestionsCommand(List<NewBankQuestion> Questions) : QuizMasterCommand<CreateQuestionsResponse>
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.CreateQuestion;
}

public record NewBankQuestion(
    QuestionType Type,
    string? Text,
    List<string>? Options,
    int? CorrectOption,
    bool? IsRight,
    string? SubjectHtml,
    string? ReferenceAnswer,
    double? WeightPercent,
    int? DurationSeconds,
    int? SubjectId,
    int? StageId,
    int? GradeId,
    Semester? Semester,
    List<int>? TagIds)
{
    public QuestionDraft ToDraft() => new(Type, Text, Options, CorrectOption, IsRight, SubjectHtml, ReferenceAnswer, WeightPercent, DurationSeconds);
}

public record CreateQuestionsResponse(IReadOnlyList<int> Ids);

public class CreateQuestionsCommandValidator : AbstractValidator<CreateQuestionsCommand>
{
    public const int MaxQuestions = 500;

    public CreateQuestionsCommandValidator()
    {
        RuleFor(c => c.Questions).NotEmpty().Must(list => list.Count <= MaxQuestions)
            .WithMessage($"Upload at most {MaxQuestions} questions at a time.");
        RuleForEach(c => c.Questions).ChildRules(question =>
        {
            question.AddQuestionContentRules(q => q.Type, q => q.Text, q => q.Options, q => q.SubjectHtml, q => q.ReferenceAnswer);
            question.AddQuestionTagRules(q => q.TagIds);
        });
    }
}
