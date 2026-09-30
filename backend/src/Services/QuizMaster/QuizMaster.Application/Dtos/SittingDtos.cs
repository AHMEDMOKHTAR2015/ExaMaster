namespace QuizMaster.Application.Dtos;

//insight - what a student receives to SIT a quiz. These types have no member an answer could be mapped into,
// so no mapping mistake can ship the key before submission: it is withheld by construction, not by discipline.
public record SittingDto(
    int? BankQuizId,
    int? TeacherQuizId,
    int? HomeworkId,
    string Name,
    QuizSettings Settings,
    IReadOnlyList<SittingQuestionDto> Questions)
{
    public static SittingDto From(AttemptedQuiz quiz, HomeworkAssignment? homework) => new(
        quiz.BankQuizId,
        quiz.TeacherQuizId,
        homework?.Id,
        homework?.Title ?? quiz.Name,
        quiz.Settings,
        quiz.Questions.Select(SittingQuestionDto.From).ToList());
}

public record SittingQuestionDto(
    int QuestionId,
    QuestionType Type,
    string Name,
    IReadOnlyList<QuestionOption> Options,
    IReadOnlyList<CompleteSegment> Segments,
    string? SubjectHtml,
    double? WeightPercent,
    int DurationSeconds)
{
    // Every question gets a clock: an unset authored duration is the app's one-minute default.
    public const int DefaultDurationSeconds = 60;

    public static SittingQuestionDto From(IQuestionDefinition question) => new(
        question.QuestionId,
        question.Type,
        question.Name,
        question.Options,
        question.Segments,
        question.SubjectHtml,
        question.WeightPercent,
        question.DurationSeconds ?? DefaultDurationSeconds);
}
