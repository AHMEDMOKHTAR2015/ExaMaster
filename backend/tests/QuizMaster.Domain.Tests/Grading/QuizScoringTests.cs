namespace QuizMaster.Domain.Tests.Grading;

// Port of the app's question-scoring.spec.ts. The first cases are the regression guard for every pre-existing quiz:
// with no Explain questions, the weighting must reproduce the original 100 / n math exactly.
public class QuizScoringTests
{
    private static WeightableQuestion Auto(int id, QuestionType type = QuestionType.Choose) => new(id, type, null);
    private static WeightableQuestion Explain(int id, double? weight = null) => new(id, QuestionType.Explain, weight);

    [Fact]
    public void Splits_100_equally_when_there_are_no_Explain_questions()
    {
        var weighting = QuizScoring.ComputeWeighting([Auto(1), Auto(2), Auto(3), Auto(4)]);

        Assert.Equal(25, weighting.AutoPerQuestionPercent);
        Assert.Equal(25, weighting.WeightOf(1));
        Assert.Equal(0, weighting.ExplainTotalPercent);
    }

    [Fact]
    public void Keeps_the_total_at_100_in_the_non_round_case()
    {
        var weighting = QuizScoring.ComputeWeighting([Auto(1), Auto(2), Auto(3)]);

        Assert.Equal(100, new[] { 1, 2, 3 }.Sum(weighting.WeightOf), 10);
    }

    [Fact]
    public void Treats_every_non_Explain_type_the_same()
    {
        var weighting = QuizScoring.ComputeWeighting([Auto(1), Auto(2, QuestionType.Complete), Auto(3, QuestionType.RightWrong)]);

        Assert.Equal(weighting.WeightOf(1), weighting.WeightOf(2), 10);
        Assert.Equal(weighting.WeightOf(1), weighting.WeightOf(3), 10);
    }

    [Fact]
    public void Returns_an_empty_weighting_for_an_empty_quiz()
    {
        var weighting = QuizScoring.ComputeWeighting([]);

        Assert.Empty(weighting.ByQuestionId);
        Assert.Equal(0, weighting.AutoPerQuestionPercent);
    }

    [Fact]
    public void Gives_Explain_its_authored_share_and_splits_the_rest_equally()
    {
        var weighting = QuizScoring.ComputeWeighting([Auto(1), Auto(2), Auto(3), Explain(4, 40)]);

        Assert.Equal(40, weighting.WeightOf(4));
        Assert.Equal(20, weighting.AutoPerQuestionPercent, 10);
        Assert.Equal(20, weighting.WeightOf(1), 10);
    }

    [Fact]
    public void Falls_back_to_the_default_weight_when_none_was_authored()
    {
        var weighting = QuizScoring.ComputeWeighting([Auto(1), Explain(2)]);

        Assert.Equal(10, weighting.WeightOf(2));
        Assert.Equal(90, weighting.WeightOf(1));
    }

    [Fact]
    public void Scales_an_over_subscribed_quiz_down_to_100()
    {
        var weighting = QuizScoring.ComputeWeighting([Auto(1), Explain(2, 80), Explain(3, 80)]);

        Assert.Equal(100, weighting.ExplainTotalPercent, 10);
        Assert.Equal(50, weighting.WeightOf(2), 10);
        Assert.Equal(0, weighting.AutoPerQuestionPercent, 10);
    }

    [Fact]
    public void Clamps_an_out_of_range_authored_weight_before_using_it()
    {
        var weighting = QuizScoring.ComputeWeighting([Auto(1), Explain(2, 0), Explain(3, 999)]);

        Assert.Equal(100, weighting.ExplainTotalPercent, 10);
        Assert.True(weighting.WeightOf(2) < weighting.WeightOf(3));
    }

    [Fact]
    public void Scales_an_all_Explain_quiz_up_to_fill_100_preserving_the_ratio()
    {
        var even = QuizScoring.ComputeWeighting([Explain(1, 10), Explain(2, 10)]);
        var uneven = QuizScoring.ComputeWeighting([Explain(1, 30), Explain(2, 10)]);

        Assert.Equal(50, even.WeightOf(1), 10);
        Assert.Equal(0, even.AutoPerQuestionPercent);
        Assert.Equal(75, uneven.WeightOf(1), 10);
        Assert.Equal(25, uneven.WeightOf(2), 10);
    }

    [Fact]
    public void Validates_explain_weights_at_save_time()
    {
        Assert.Null(QuizScoring.ValidateExplainWeights([Auto(1), Auto(2)]));
        Assert.Null(QuizScoring.ValidateExplainWeights([Auto(1), Explain(2, 60)]));
        Assert.Equal(ExplainWeightError.Over100, QuizScoring.ValidateExplainWeights([Auto(1), Explain(2, 60), Explain(3, 50)]));
        Assert.Equal(ExplainWeightError.NoAutoBudget, QuizScoring.ValidateExplainWeights([Auto(1), Explain(2, 100)]));
        Assert.Null(QuizScoring.ValidateExplainWeights([Explain(1, 50), Explain(2, 50)]));
    }

    [Fact]
    public void Review_and_authored_weight_are_different_questions()
    {
        Assert.True(QuizScoring.RequiresManualReview(QuestionType.Explain));
        Assert.True(QuizScoring.RequiresManualReview(QuestionType.Complete));
        Assert.False(QuizScoring.RequiresManualReview(QuestionType.Choose));
        Assert.False(QuizScoring.RequiresManualReview(QuestionType.RightWrong));

        Assert.True(QuizScoring.CarriesAuthoredWeight(QuestionType.Explain));
        Assert.False(QuizScoring.CarriesAuthoredWeight(QuestionType.Complete));
    }

    [Fact]
    public void Leaves_a_Complete_question_worth_an_ordinary_share_but_flagged_for_review()
    {
        var weighting = QuizScoring.ComputeWeighting([Auto(1), Auto(2, QuestionType.Complete), Auto(3, QuestionType.RightWrong), Auto(4)]);

        Assert.All(new[] { 1, 2, 3, 4 }, id => Assert.Equal(25, weighting.WeightOf(id)));
        Assert.True(weighting.ByQuestionId[2].RequiresReview);
        Assert.Null(QuizScoring.ValidateExplainWeights(
            [Auto(1, QuestionType.Complete), Auto(2, QuestionType.Complete), Auto(3, QuestionType.Complete)]));
    }

    [Fact]
    public void Sums_graded_shares_and_ignores_ungraded_ones()
        => Assert.Equal(20, QuizScoring.SumEarnedPercent([20, 0, null]));

    [Theory]
    [InlineData(66.6, 67)]
    [InlineData(33.3, 33)]
    [InlineData(2.5, 3)]     // JavaScript's Math.round, not banker's rounding (which gives 2)
    [InlineData(62.5, 63)]
    public void Rounds_half_up_like_the_app(double value, int expected)
        => Assert.Equal(expected, QuizScoring.RoundPercent(value));
}
