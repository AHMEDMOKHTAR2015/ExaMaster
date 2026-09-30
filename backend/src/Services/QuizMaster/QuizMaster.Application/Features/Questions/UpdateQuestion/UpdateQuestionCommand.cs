using QuizMaster.Application.Features.Questions.Shared;

namespace QuizMaster.Application.Features.Questions.UpdateQuestion;

// Past attempts are unaffected: every participation snapshots the question and the weighting it was graded against.
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
    Semester? Semester) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.UpdateQuestion;

    public QuestionDraft ToDraft() => new(Type, Text, Options, CorrectOption, IsRight, SubjectHtml, ReferenceAnswer, WeightPercent, DurationSeconds);
}

public class UpdateQuestionCommandValidator : QuizMasterCommandValidator<UpdateQuestionCommand>
{
    public UpdateQuestionCommandValidator()
        => this.AddQuestionContentRules(c => c.Type, c => c.Text, c => c.Options, c => c.SubjectHtml, c => c.ReferenceAnswer);
}
