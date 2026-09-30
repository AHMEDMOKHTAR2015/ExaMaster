namespace QuizMaster.Domain.Questions;

// What a sat question is, whoever authored it: a bank Question or a TeacherQuizQuestion.
// The grader works on this shape only, so both sources are graded by exactly one implementation.
public interface IQuestionDefinition
{
    // The id a student's responses and the participation answers refer to.
    int QuestionId { get; }
    QuestionType Type { get; }
    // Always plain text. Masked passage for Complete; flattened prompt for Explain.
    string Name { get; }
    IReadOnlyList<QuestionOption> Options { get; }
    IReadOnlyList<CompleteSegment> Segments { get; }
    string? SubjectHtml { get; }
    double? WeightPercent { get; }
    int? DurationSeconds { get; }
    AnswerKey Key { get; }
}
