using QuizMaster.Application.Features.Questions.Shared;

namespace QuizMaster.Application.Features.Questions.CreateQuestion;

// Adds a question to the organization's bank. The question and its answer are one write, so they can never diverge.
// Which members apply depends on Type: see QuestionDraft.
public record CreateQuestionCommand(
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
    public override QuizMasterActionType ActionType => QuizMasterActionType.CreateQuestion;

    public QuestionDraft ToDraft() => new(Type, Text, Options, CorrectOption, IsRight, SubjectHtml, ReferenceAnswer, WeightPercent, DurationSeconds);
}

public class CreateQuestionCommandValidator : AbstractValidator<CreateQuestionCommand>
{
    public CreateQuestionCommandValidator()
        => this.AddQuestionContentRules(c => c.Type, c => c.Text, c => c.Options, c => c.SubjectHtml, c => c.ReferenceAnswer);
}
