using static QuizMaster.Domain.Tests.TestData;

namespace QuizMaster.Domain.Tests.Questions;

// Rich text is stored clean: some screens put it back into a live editor, where a script would run.
public class HtmlCleaningTests
{
    private const string Hostile = "<p>Explain <b>seasons</b><img src=x onerror=\"alert(1)\"><script>steal()</script>" +
                                   "<a href=\"javascript:steal()\">here</a></p>";

    [Fact]
    public void An_explain_prompt_and_model_answer_keep_their_formatting_and_lose_any_script()
    {
        var authored = AuthoredQuestion.From(new QuestionDraft(QuestionType.Explain, SubjectHtml: Hostile, ReferenceAnswer: Hostile, WeightPercent: 20));

        foreach (var html in new[] { authored.SubjectHtml!, authored.Key.ReferenceAnswer! })
        {
            Assert.Contains("<b>seasons</b>", html);
            Assert.DoesNotContain("onerror", html);
            Assert.DoesNotContain("<script", html);
            Assert.DoesNotContain("javascript:", html);
        }
    }

    [Fact]
    public void A_students_written_answer_is_cleaned_before_it_is_stored()
    {
        var participation = Participation.Submit(Student(Class()), Quiz(Explain(id: 3)), null, null, [Written(3, Hostile)], null,
            Action(QuizMasterActionType.SubmitQuiz, StudentId));

        var stored = participation.Answers.Single().ResponseText!;
        Assert.Contains("<b>seasons</b>", stored);
        Assert.DoesNotContain("onerror", stored);
        Assert.DoesNotContain("<script", stored);
    }
}
