namespace QuizMaster.Domain.Questions;

// A Right or Wrong question is stored as an ordinary two-option Choose question with this fixed pair.
// The names stay canonical English in storage and are translated at render time.
public static class RightWrongOptions
{
    public const int Right = 1;
    public const int Wrong = 2;

    public static readonly IReadOnlyList<QuestionOption> All = [new(Right, "Right"), new(Wrong, "Wrong")];

    public static int CorrectOptionId(bool isRight) => isRight ? Right : Wrong;
}
