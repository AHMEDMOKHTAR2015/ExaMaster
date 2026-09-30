namespace QuizMaster.Domain.Grading;

public sealed record WeightableQuestion(int Id, QuestionType Type, double? WeightPercent);

public sealed record QuestionWeight(double WeightPercent, bool RequiresReview);

// Every question's share of a 100-point quiz. Shares are fractional; round only to display or persist a total.
public sealed class QuizWeighting(IReadOnlyDictionary<int, QuestionWeight> byQuestionId, double explainTotalPercent, double autoPerQuestionPercent)
{
    public static readonly QuizWeighting Empty = new(new Dictionary<int, QuestionWeight>(), 0, 0);

    public IReadOnlyDictionary<int, QuestionWeight> ByQuestionId { get; } = byQuestionId;

    // Combined share held by Explain questions after normalization, 0–100.
    public double ExplainTotalPercent { get; } = explainTotalPercent;

    // Share each non-Explain question carries. 0 when the quiz is all Explain.
    public double AutoPerQuestionPercent { get; } = autoPerQuestionPercent;

    public double WeightOf(int questionId) => ByQuestionId.TryGetValue(questionId, out var weight) ? weight.WeightPercent : 0;
}
