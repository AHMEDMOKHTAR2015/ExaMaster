namespace QuizMaster.Domain.Tests.Questions;

// Port of the app's complete-question.spec.ts and explain-question.spec.ts, plus the authoring rules the server now owns.
public class QuestionAuthoringTests
{
    [Fact]
    public void Parses_a_single_blank_with_surrounding_text()
    {
        var (segments, keywords) = CompletePassage.Parse("The capital of France is Paris(Complete).");

        Assert.Equal(["Paris"], keywords);
        Assert.Equal(
            [CompleteSegment.ForText("The capital of France is "), CompleteSegment.ForBlank(0, 5), CompleteSegment.ForText(".")],
            segments);
    }

    [Fact]
    public void Parses_several_blanks_indexed_in_order()
    {
        var (segments, keywords) = CompletePassage.Parse("Water is H(Complete)2O and the sky is blue(Complete).");

        Assert.Equal(["H", "blue"], keywords);
        var blanks = segments.Where(segment => segment.IsBlank).ToList();
        Assert.Equal([0, 1], blanks.Select(blank => blank.Index!.Value));
        Assert.Equal([1, 4], blanks.Select(blank => blank.ExpectedLength!.Value));
    }

    [Fact]
    public void Treats_consecutive_marked_words_as_adjacent_blanks()
        => Assert.Equal(["New", "York"], CompletePassage.Parse("I live in New(Complete) York(Complete).").Keywords);

    [Fact]
    public void Right_trims_unusual_spacing_before_the_marker()
    {
        var (segments, keywords) = CompletePassage.Parse("The answer is    Cairo   (Complete)!");

        Assert.Equal(["Cairo"], keywords);
        Assert.Equal(CompleteSegment.ForText("The answer is    "), segments[0]);
    }

    [Fact]
    public void Leaves_an_unmarked_repeat_of_the_keyword_as_text()
    {
        var (segments, keywords) = CompletePassage.Parse("Paris and Paris(Complete) differ.");

        Assert.Equal(["Paris"], keywords);
        Assert.Equal(CompleteSegment.ForText("Paris and "), segments[0]);
        Assert.Single(segments, segment => segment.IsBlank);
    }

    [Fact]
    public void Handles_a_marker_at_the_very_start()
        => Assert.Equal(CompleteSegment.ForBlank(0, 5), CompletePassage.Parse("Paris(Complete) is the capital.").Segments[0]);

    [Theory]
    [InlineData("Just a plain sentence.")]
    [InlineData("This is (complete) text.")]            // the marker is case-sensitive
    [InlineData("Paris(Complete)  (Complete) done")]    // a marker with no preceding word
    public void Rejects_passages_without_a_usable_blank(string raw)
        => Assert.Throws<DomainException>(() => CompletePassage.Parse(raw));

    [Fact]
    public void Masks_every_blank_with_a_fixed_placeholder()
    {
        var (segments, _) = CompletePassage.Parse("The capital is Paris(Complete) and water is H(Complete)2O.");

        Assert.Equal("The capital is _____ and water is _____2O.", CompletePassage.RenderPreview(segments));
    }

    [Fact]
    public void Reconstructs_parseable_authored_text()
    {
        const string original = "The capital of France is Paris(Complete).";
        var (segments, keywords) = CompletePassage.Parse(original);

        Assert.Equal(original, CompletePassage.Reconstruct(segments, keywords));
    }

    [Fact]
    public void Normalizes_typed_answers()
    {
        Assert.Equal("paris", CompletePassage.Normalize("  Paris  "));
        Assert.Equal(string.Empty, CompletePassage.Normalize(null));
        Assert.Equal("paris", CompletePassage.Normalize("﻿ Paris ﻿ "));
    }

    [Theory]
    [InlineData("<p>a</p><p>b</p>", "a b")]
    [InlineData("<p>Explain <b>photosynthesis</b>.</p>", "Explain photosynthesis.")]
    [InlineData("Fish &amp; chips&nbsp;&lt;3", "Fish & chips <3")]
    [InlineData("<p><br></p>", "")]
    [InlineData(null, "")]
    public void Flattens_html_to_plain_text_like_the_app(string? html, string expected)
        => Assert.Equal(expected, HtmlText.PlainText(html));

    [Fact]
    public void A_Complete_question_stores_the_masked_passage_as_its_name_and_the_keywords_as_its_key()
    {
        var authored = AuthoredQuestion.From(new QuestionDraft(QuestionType.Complete, "The capital is Paris(Complete)."));

        Assert.Equal("The capital is _____.", authored.Name);
        Assert.DoesNotContain("Paris", authored.Name);
        Assert.Equal(["Paris"], authored.Key.CorrectBlanks);
    }

    [Fact]
    public void A_Choose_question_numbers_its_options_and_keys_the_correct_one()
    {
        var authored = AuthoredQuestion.From(new QuestionDraft(QuestionType.Choose, "Pick", ["A", "B", "C"], CorrectOption: 3));

        Assert.Equal([1, 2, 3], authored.Options.Select(option => option.Id));
        Assert.Equal(3, authored.Key.CorrectOptionId);
    }

    [Fact]
    public void A_Right_or_Wrong_question_always_stores_the_canonical_pair()
    {
        var authored = AuthoredQuestion.From(new QuestionDraft(QuestionType.RightWrong, "The Earth is flat.", IsRight: false));

        Assert.Equal(RightWrongOptions.All, authored.Options);
        Assert.Equal(RightWrongOptions.Wrong, authored.Key.CorrectOptionId);
    }

    [Fact]
    public void An_Explain_question_stores_its_flattened_prompt_and_keeps_the_model_answer_in_the_key()
    {
        var authored = AuthoredQuestion.From(new QuestionDraft(
            QuestionType.Explain, SubjectHtml: "<p>Why?</p>", ReferenceAnswer: "<p>Because.</p>", WeightPercent: 20));

        Assert.Equal("Why?", authored.Name);
        Assert.Equal("<p>Because.</p>", authored.Key.ReferenceAnswer);
        Assert.Equal(20, authored.WeightPercent);
    }

    public static TheoryData<QuestionDraft> InvalidDrafts => new()
    {
        new QuestionDraft(QuestionType.Choose, "Pick", ["A"], CorrectOption: 1),                   // too few options
        new QuestionDraft(QuestionType.Choose, "Pick", ["A", "B"], CorrectOption: 3),              // correct option out of range
        new QuestionDraft(QuestionType.Choose, "Pick", ["A", "a"], CorrectOption: 1),              // duplicate options
        new QuestionDraft(QuestionType.Choose, " ", ["A", "B"], CorrectOption: 1),                 // no text
        new QuestionDraft(QuestionType.RightWrong, "Statement"),                                    // no verdict
        new QuestionDraft(QuestionType.Complete, "No markers here"),
        new QuestionDraft(QuestionType.Explain, SubjectHtml: "<p><br></p>", ReferenceAnswer: "<p>x</p>", WeightPercent: 10),
        new QuestionDraft(QuestionType.Explain, SubjectHtml: "<p>Why?</p>", ReferenceAnswer: "", WeightPercent: 10),
        new QuestionDraft(QuestionType.Explain, SubjectHtml: "<p>Why?</p>", ReferenceAnswer: "<p>x</p>", WeightPercent: 0),
        new QuestionDraft(QuestionType.Choose, "Pick", ["A", "B"], CorrectOption: 1, DurationSeconds: 1),
    };

    [Theory]
    [MemberData(nameof(InvalidDrafts))]
    public void Rejects_invalid_drafts(QuestionDraft draft)
        => Assert.Throws<DomainException>(() => AuthoredQuestion.From(draft));
}
