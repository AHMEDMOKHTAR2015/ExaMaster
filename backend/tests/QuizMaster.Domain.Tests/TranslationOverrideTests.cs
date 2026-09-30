using static QuizMaster.Domain.Tests.TestData;

namespace QuizMaster.Domain.Tests;

public class TranslationOverrideTests
{
    private static readonly TestAction Edit = Action(QuizMasterActionType.SaveTranslationOverrides, AdminId);

    [Theory]
    [InlineData("nav.dashboard")]
    [InlineData("notifications.reviewStatus.revision-requested")]
    [InlineData("questionsBank.form.explain.empty_subject")]
    public void Every_shape_of_shipped_key_is_accepted(string key)
        => Assert.Equal(key, TranslationOverride.Create("ar", key, "لوحة", Edit).Key);

    [Theory]
    [InlineData("")]
    [InlineData("nav..dashboard")]
    [InlineData(".nav")]
    [InlineData("nav.")]
    [InlineData("nav dashboard")]
    [InlineData("values.__proto__.x{")]
    public void Anything_else_is_not_a_key(string key)
        => Assert.Throws<DomainException>(() => TranslationOverride.Create("en", key, "Home", Edit));

    [Fact]
    public void Only_the_shipped_languages()
        => Assert.Throws<DomainException>(() => TranslationOverride.Create("fr", "nav.dashboard", "Accueil", Edit));

    [Fact]
    public void A_label_cannot_be_blanked()
    {
        Assert.Throws<DomainException>(() => TranslationOverride.Create("en", "nav.dashboard", "  ", Edit));

        var label = TranslationOverride.Create("en", "nav.dashboard", "Home", Edit);
        Assert.Throws<DomainException>(() => label.Rewrite("", Edit));
    }

    [Fact]
    public void Placeholders_are_kept_as_written()
        => Assert.Equal("Hi {{ name }}", TranslationOverride.Create("en", "welcome", "Hi {{ name }}", Edit).Text);

    [Fact]
    public void An_overlong_label_is_refused()
        => Assert.Throws<DomainException>(() => TranslationOverride.Create("en", "nav.dashboard", new string('x', TranslationOverride.MaxTextLength + 1), Edit));
}
