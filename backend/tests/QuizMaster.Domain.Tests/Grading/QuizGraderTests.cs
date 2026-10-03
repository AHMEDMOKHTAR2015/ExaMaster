using static QuizMaster.Domain.Tests.TestData;

namespace QuizMaster.Domain.Tests.Grading;

// Port of the app's grade-quiz.spec.ts. Grading decides real marks, so every branch is covered directly.
public class QuizGraderTests
{
    private static GradedAnswer GradeOne(IQuestionDefinition question, QuestionResponse? response = null)
        => QuizGrader.Grade([question], response is null ? [] : [response]).Answers.Single();

    [Fact]
    public void Choose_marks_the_selected_correct_option_correct_with_its_full_weight()
    {
        var answer = GradeOne(Choose(), Selected(1, 2));

        Assert.True(answer.IsCorrect);
        Assert.Equal(2, answer.SelectedOptionId);
        Assert.Equal(2, answer.CorrectOptionId);
        Assert.Equal(answer.WeightPercent, answer.EarnedPercent);
        Assert.False(answer.RequiresReview);
    }

    [Fact]
    public void Choose_marks_a_wrong_selection_wrong_and_records_both_options()
    {
        var answer = GradeOne(Choose(), Selected(1, 1));

        Assert.False(answer.IsCorrect);
        Assert.Equal(0, answer.EarnedPercent);
        Assert.Equal("A", answer.SelectedOptionText);
        Assert.Equal("B", answer.CorrectOptionText);
    }

    [Fact]
    public void An_unanswered_question_is_wrong_not_vacuously_correct()
    {
        var answer = GradeOne(Choose());

        Assert.False(answer.IsCorrect);
        Assert.Null(answer.SelectedOptionId);
        Assert.Equal(0, answer.EarnedPercent);
    }

    [Fact]
    public void A_response_naming_an_option_that_does_not_exist_is_unanswered()
    {
        var answer = GradeOne(Choose(), Selected(1, 99));

        Assert.Null(answer.SelectedOptionId);
        Assert.False(answer.IsCorrect);
    }

    [Fact]
    public void Right_or_Wrong_is_graded_through_the_Choose_branch()
    {
        var answer = GradeOne(RightWrong(isRight: true), Selected(1, RightWrongOptions.Right));

        Assert.True(answer.IsCorrect);
        Assert.Equal("Right", answer.CorrectOptionText);
        Assert.False(answer.RequiresReview);
    }

    [Fact]
    public void Complete_awaits_a_teacher_even_on_an_exact_match_but_records_the_match()
    {
        var answer = GradeOne(Complete(), Typed(2, "  pARiS "));

        Assert.True(answer.RequiresReview);
        Assert.False(answer.IsCorrect);
        Assert.Null(answer.EarnedPercent);
        Assert.True(answer.Blanks![0].IsCorrect);
        Assert.Equal("pARiS", answer.Blanks[0].UserAnswer);   // trimmed, original casing kept
    }

    [Fact]
    public void Complete_records_each_blank_separately_and_suggests_pro_rata_credit()
    {
        var answer = GradeOne(Complete(2, "Paris", "France"), Typed(2, "Paris", "Germany"));

        Assert.Equal([true, false], answer.Blanks!.Select(blank => blank.IsCorrect));
        Assert.Null(answer.EarnedPercent);
        Assert.Equal(50, QuizGrader.SuggestedCompleteAward(answer));   // sole question = worth 100; one of two blanks
    }

    [Fact]
    public void Complete_suggests_points_out_of_the_answers_maximum()
    {
        // 40 questions: each is worth 2.5%, marked out of 3 points; one of two blanks matches = half of 3 = 1.5 → 2 points
        // (half of the 2.5% share would round to 1, which as points would be a third of the question, not half)
        IQuestionDefinition[] questions = [.. Enumerable.Range(1, 39).Select(id => Choose(id)), Complete(40, "Paris", "France")];
        var answer = QuizGrader.Grade(questions, [Typed(40, "Paris", "Germany")]).Answers.Single(graded => graded.QuestionId == 40);

        Assert.Equal(2, QuizGrader.SuggestedCompleteAward(answer));
    }

    [Fact]
    public void Complete_records_an_empty_blank_as_null()
    {
        var answer = GradeOne(Complete());

        Assert.Null(answer.Blanks![0].UserAnswer);
        Assert.False(answer.IsCorrect);
    }

    [Fact]
    public void Complete_applies_the_key_by_blank_index_not_array_position()
    {
        var question = new TestQuestion(2, QuestionType.Complete, "_____ and _____", [],
            [CompleteSegment.ForBlank(2, 6), CompleteSegment.ForText(" and "), CompleteSegment.ForBlank(0, 5)],
            new AnswerKey(null, ["Paris", "unused", "France"], null));

        var answer = GradeOne(question, new QuestionResponse(2, Blanks: [new(0, "paris"), new(2, "france")]));

        Assert.Equal("France", answer.Blanks!.Single(blank => blank.Index == 2).CorrectAnswer);
        Assert.Equal("Paris", answer.Blanks!.Single(blank => blank.Index == 0).CorrectAnswer);
        Assert.All(answer.Blanks!, blank => Assert.True(blank.IsCorrect));
    }

    [Fact]
    public void Explain_defers_the_verdict_and_flattens_the_prompt()
    {
        var answer = GradeOne(Explain(), Written(3, "<p>Plants use sunlight.</p>"));

        Assert.True(answer.RequiresReview);
        Assert.Null(answer.EarnedPercent);            // null, not 0: a pending answer does not drag the score down
        Assert.False(answer.IsCorrect);
        Assert.True(answer.WeightPercent > 0);
        Assert.Equal("<p>Plants convert light into chemical energy.</p>", answer.ReferenceAnswer);
        Assert.Equal(0, QuizGrader.SuggestedCompleteAward(answer));
    }

    [Fact]
    public void Explain_prompt_is_flattened_to_the_same_plain_text_as_the_app()
        => Assert.Equal("Explain photosynthesis.", GradeOne(Explain()).QuestionName);

    [Fact]
    public void Counts_only_auto_graded_questions_towards_correct_and_wrong()
    {
        var grade = QuizGrader.Grade(
            [Choose(1), Choose(2), Explain(3)],
            [Selected(1, 2), Selected(2, 1), Written(3, "<p>something</p>")]);

        Assert.Equal(1, grade.Score);
        Assert.Equal(1, grade.CorrectCount);
        Assert.Equal(1, grade.WrongCount);
        Assert.Equal(1, grade.PendingReviewCount);
    }

    [Fact]
    public void Reports_the_auto_graded_share_while_an_Explain_answer_is_pending()
    {
        var grade = QuizGrader.Grade([Choose(1), Explain(3, weightPercent: 40)], [Selected(1, 2)]);

        Assert.Equal(60, grade.ScorePercent);
    }

    [Fact]
    public void Keeps_Complete_answers_out_of_correct_and_wrong()
    {
        var grade = QuizGrader.Grade([Choose(1), Complete(2)], [Selected(1, 2), Typed(2, "Paris")]);

        Assert.Equal(1, grade.CorrectCount);
        Assert.Equal(0, grade.WrongCount);
        Assert.Equal(1, grade.PendingReviewCount);
    }

    [Fact]
    public void Reports_zero_of_zero_on_an_all_Complete_quiz()
    {
        var grade = QuizGrader.Grade([Complete(1), Complete(2), Complete(3)], [Typed(1, "paris"), Typed(2, "paris"), Typed(3, "paris")]);

        Assert.Equal(0, grade.CorrectCount);
        Assert.Equal(0, grade.WrongCount);
        Assert.Equal(3, grade.PendingReviewCount);
        Assert.Equal(0, grade.ScorePercent);
    }

    [Fact]
    public void Grades_an_empty_quiz_without_throwing()
    {
        var grade = QuizGrader.Grade([], []);

        Assert.Empty(grade.Answers);
        Assert.Equal(0, grade.Score);
        Assert.Equal(0, grade.ScorePercent);
    }

    [Fact]
    public void Ignores_responses_for_questions_that_are_not_part_of_the_quiz()
    {
        var grade = QuizGrader.Grade([Choose(1)], [Selected(1, 2), Selected(999, 1)]);

        Assert.Single(grade.Answers);
        Assert.Equal(100, grade.ScorePercent);
    }

    [Fact]
    public void Redaction_strips_what_reveals_the_answer_and_keeps_the_verdict()
    {
        var choose = QuizGrader.Redact(GradeOne(Choose(), Selected(1, 1)));
        Assert.Null(choose.CorrectOptionId);
        Assert.Null(choose.CorrectOptionText);
        Assert.False(choose.IsCorrect);
        Assert.Equal(1, choose.SelectedOptionId);
        Assert.Equal("A", choose.SelectedOptionText);
        Assert.Equal(0, choose.EarnedPercent);

        var complete = QuizGrader.Redact(GradeOne(Complete(), Typed(2, "paris")));
        Assert.Equal(string.Empty, complete.Blanks![0].CorrectAnswer);
        Assert.True(complete.Blanks[0].IsCorrect);
        Assert.Equal("paris", complete.Blanks[0].UserAnswer);

        var explain = QuizGrader.Redact(GradeOne(Explain(), Written(3, "<p>Chlorophyll.</p>")));
        Assert.Null(explain.ReferenceAnswer);
        Assert.Equal("<p>Chlorophyll.</p>", explain.ResponseText);
        Assert.True(explain.RequiresReview);
    }

    [Fact]
    public void Knows_when_every_question_has_a_usable_answer()
    {
        IReadOnlyList<IQuestionDefinition> quiz = [Choose(1), Complete(2), Explain(3)];

        Assert.True(QuizGrader.IsFullyAnswered(quiz, [Selected(1, 1), Typed(2, "x"), Written(3, "<p>y</p>")]));
        Assert.False(QuizGrader.IsFullyAnswered(quiz, [Selected(1, 1), Typed(2, "  "), Written(3, "<p>y</p>")]));
        Assert.False(QuizGrader.IsFullyAnswered(quiz, [Selected(1, 1), Typed(2, "x"), Written(3, "<p><br></p>")]));
        Assert.True(QuizGrader.IsFullyAnswered([], []));
    }
}
