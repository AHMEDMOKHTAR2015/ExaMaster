using QuizMaster.Application.Features.Questions.Shared;

namespace QuizMaster.Application.Features.Questions.UpdateQuestion;

// Past attempts are unaffected: every participation snapshots the question, its tags and the weighting it was graded against.
// TagIds null keeps the question's tags (dropped if it moves to another subject).
public record UpdateQuestionCommand(
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
    List<int>? TagIds) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.UpdateQuestion;

    public QuestionDraft ToDraft() => new(Type, Text, Options, CorrectOption, IsRight, SubjectHtml, ReferenceAnswer, WeightPercent, DurationSeconds);
}

public class UpdateQuestionCommandValidator : QuizMasterCommandValidator<UpdateQuestionCommand>
{
    public UpdateQuestionCommandValidator()
    {
        this.AddQuestionContentRules(c => c.Type, c => c.Text, c => c.Options, c => c.SubjectHtml, c => c.ReferenceAnswer);
        this.AddQuestionTagRules(c => c.TagIds);
    }
}
