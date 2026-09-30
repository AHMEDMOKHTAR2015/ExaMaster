namespace QuizMaster.Domain.Questions;

// The answer to one question. Exactly one member applies per question type:
// CorrectOptionId (Choose, Right or Wrong), CorrectBlanks (Complete, indexed by blank index), ReferenceAnswer (Explain, rich HTML).
//insight - this is the security boundary of the whole product: it never reaches a student before their attempt is graded
public sealed record AnswerKey(int? CorrectOptionId, IReadOnlyList<string>? CorrectBlanks, string? ReferenceAnswer)
{
    public static readonly AnswerKey Empty = new(null, null, null);
}
