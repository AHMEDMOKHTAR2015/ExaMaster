namespace QuizMaster.Domain.Grading;

public enum ExplainWeightError
{
    Over100,        // the Explain weights alone exceed the whole quiz
    NoAutoBudget,   // they total 100 while other questions are present, which would leave those worth nothing
}

// Weighted quiz scoring (port of the app's shared/question-scoring.ts).
// Explain questions take their authored percentages off the top; every other question divides what is left, equally.
// A quiz with no Explain questions therefore yields exactly 100 / questionCount per question, the app's original math.
public static class QuizScoring
{
    public const double DefaultExplainWeightPercent = 10;
    public const double MinExplainWeightPercent = 1;
    public const double MaxExplainWeightPercent = 100;

    //insight - two predicates that look interchangeable and are not. Complete needs a human (a blank can have several right
    // answers) but claims no authored weight: merging them would give every Complete question the default Explain weight
    // off the top and silently re-weight the rest of the quiz.
    public static bool RequiresManualReview(QuestionType type) => type is QuestionType.Explain or QuestionType.Complete;

    public static bool CarriesAuthoredWeight(QuestionType type) => type is QuestionType.Explain;

    // 1. Each Explain question claims its authored weight, clamped to 1–100.
    // 2. Claims totalling more than 100 are scaled down proportionally: bank questions are authored independently of the
    //    quizzes they end up in, so an over-subscribed quiz is data to survive, not to crash on.
    // 3. An all-Explain quiz is scaled (up or down) to total exactly 100.
    // 4. Whatever budget is left is divided equally across the other questions.
    public static QuizWeighting ComputeWeighting(IReadOnlyList<WeightableQuestion> questions)
    {
        if (questions.Count == 0)
            return QuizWeighting.Empty;

        var explain = questions.Where(q => CarriesAuthoredWeight(q.Type)).ToList();
        var autoCount = questions.Count - explain.Count;

        var rawWeights = explain.Select(q => ClampWeight(q.WeightPercent)).ToList();
        var rawTotal = rawWeights.Sum();

        var scale = 1.0;
        if (rawTotal > 100)
            scale = 100 / rawTotal;
        else if (autoCount == 0 && rawTotal > 0)
            scale = 100 / rawTotal;

        var byQuestionId = new Dictionary<int, QuestionWeight>();
        var explainTotalPercent = 0.0;
        for (var i = 0; i < explain.Count; i++)
        {
            var weightPercent = rawWeights[i] * scale;
            explainTotalPercent += weightPercent;
            byQuestionId[explain[i].Id] = new QuestionWeight(weightPercent, RequiresReview: true);
        }

        var autoBudget = Math.Max(0, 100 - explainTotalPercent);
        var autoPerQuestionPercent = autoCount > 0 ? autoBudget / autoCount : 0;

        foreach (var question in questions.Where(q => !CarriesAuthoredWeight(q.Type)))
            byQuestionId[question.Id] = new QuestionWeight(autoPerQuestionPercent, RequiresManualReview(question.Type));

        return new QuizWeighting(byQuestionId, explainTotalPercent, autoPerQuestionPercent);
    }

    // Save-time check for a quiz being assembled: reject weights the author almost certainly did not intend,
    // rather than silently normalizing them the way ComputeWeighting does at runtime.
    public static ExplainWeightError? ValidateExplainWeights(IReadOnlyList<WeightableQuestion> questions)
    {
        var explain = questions.Where(q => CarriesAuthoredWeight(q.Type)).ToList();
        if (explain.Count == 0)
            return null;

        var total = explain.Sum(q => ClampWeight(q.WeightPercent));
        if (total > 100)
            return ExplainWeightError.Over100;

        var autoCount = questions.Count - explain.Count;
        if (autoCount > 0 && total >= 100)
            return ExplainWeightError.NoAutoBudget;

        return null;
    }

    public static void EnsureValidExplainWeights(IReadOnlyList<WeightableQuestion> questions)
    {
        switch (ValidateExplainWeights(questions))
        {
            case ExplainWeightError.Over100:
                throw new DomainException("The Explain questions' weights add up to more than 100%.");
            case ExplainWeightError.NoAutoBudget:
                throw new DomainException("The Explain questions' weights add up to 100%, which leaves the other questions worth nothing.");
        }
    }

    // Graded shares only: an answer still awaiting a teacher (null) does not drag the score down.
    public static double SumEarnedPercent(IEnumerable<double?> earnedPercents) => earnedPercents.Sum(earned => earned ?? 0);

    // The submission's score: its graded shares added up, rounded, and never above 100.
    public static int ScorePercent(IEnumerable<double?> earnedPercents) => Math.Min(100, RoundPercent(SumEarnedPercent(earnedPercents)));

    //insight - a teacher marks a reviewed answer in whole POINTS, out of its share rounded (a 3.45% question is marked out of 3),
    // and the points are converted back to the REAL share: 3/3 earns 3.45%, 2/3 earns 2.30%. Counting points as percent
    // made full marks score 94% on a 29-question quiz and 112% on a 40-question one. At least 1 point, so a question
    // worth under half a percent can still be credited.
    public static int MaxMark(double weightPercent) => Math.Max(1, RoundPercent(weightPercent));

    public static double EarnedFromMark(double mark, double weightPercent) => weightPercent * mark / MaxMark(weightPercent);

    // JavaScript's Math.round (half rounds up), NOT .NET's default banker's rounding: scores must match the app's.
    public static int RoundPercent(double value) => (int)Math.Floor(value + 0.5);

    private static double ClampWeight(double? weight)
        => weight is { } value && double.IsFinite(value)
            ? Math.Min(MaxExplainWeightPercent, Math.Max(MinExplainWeightPercent, value))
            : DefaultExplainWeightPercent;
}
