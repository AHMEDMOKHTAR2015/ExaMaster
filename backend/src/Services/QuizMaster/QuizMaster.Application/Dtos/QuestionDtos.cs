namespace QuizMaster.Application.Dtos;

// The answer to one question. Only authoring surfaces (staff) and a graded result ever carry it.
public record AnswerKeyDto(int QuestionId, int? CorrectOptionId, IReadOnlyList<string>? CorrectBlanks, string? ReferenceAnswer);

// A question as its AUTHOR sees it: content, answer key, and Text ready to put back in the editing form
// (for Complete, the passage rebuilt with its "(Complete)" markers).
public record QuestionDto(
    int Id,
    QuestionType Type,
    string Name,
    string? Text,
    IReadOnlyList<QuestionOption> Options,
    IReadOnlyList<CompleteSegment> Segments,
    string? SubjectHtml,
    double? WeightPercent,
    int? DurationSeconds,
    AnswerKeyDto Key,
    int? SubjectId,
    int? StageId,
    int? GradeId,
    Semester? Semester,
    IReadOnlyList<int> TagIds);

// The authoring input shared by bank questions and teacher-quiz questions; see QuestionDraft for which members apply.
public record QuestionDraftDto(
    QuestionType Type,
    string? Text,
    List<string>? Options,
    int? CorrectOption,
    bool? IsRight,
    string? SubjectHtml,
    string? ReferenceAnswer,
    double? WeightPercent,
    int? DurationSeconds,
    List<int>? TagIds = null)                                     // tags of the quiz's subject
{
    public QuestionDraft ToDraft() => new(Type, Text, Options, CorrectOption, IsRight, SubjectHtml, ReferenceAnswer, WeightPercent, DurationSeconds);
}
