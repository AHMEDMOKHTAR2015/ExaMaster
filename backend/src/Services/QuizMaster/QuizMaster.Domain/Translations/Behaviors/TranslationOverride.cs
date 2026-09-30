using System.Text.RegularExpressions;

namespace QuizMaster.Domain.Translations;

public partial class TranslationOverride
{
    // The languages the client ships. Adding one is a client change first (its JSON asset), then this list.
    public static readonly IReadOnlyList<string> SupportedLanguages = ["en", "ar"];

    public const int MaxKeyLength = 128;                         // the longest shipped key is 60
    public const int MaxTextLength = 1024;                       // the longest shipped label is under 200
    public const int MaxPerLanguage = 2000;                      // comfortably above the ~1,250 shipped keys

    // Segments of letters, digits, '_' and '-', joined by dots: the shape of every shipped key.
    private static readonly Regex KeyPattern = new(@"^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$", RegexOptions.Compiled);

    public static TranslationOverride Create(string language, string key, string text, IQuizMasterAction action)
    {
        var translation = new TranslationOverride
        {
            Language = RequireLanguage(language),
            Key = RequireKey(key),
            CreatedById = action.CreatedById,
            CreatedOn = action.CreatedOn
        };
        translation.Text = RequireText(text);
        return translation;
    }

    public void Rewrite(string text, IQuizMasterAction action)
    {
        Text = RequireText(text);
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    public static string RequireLanguage(string language)
        => SupportedLanguages.Contains(language)
            ? language
            : throw new DomainException($"Labels can be customised in {string.Join(" and ", SupportedLanguages)} only.");

    public static string RequireKey(string key)
        => key.Length <= MaxKeyLength && KeyPattern.IsMatch(key)
            ? key
            : throw new DomainException($"'{key}' is not a label key (dotted segments of letters, digits, '_' and '-').");

    //insight - an empty label is refused rather than stored: it would blank a button. Removing the override is how a
    // school goes back to the shipped wording.
    private static string RequireText(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            throw new DomainException("A customised label cannot be empty; remove the customisation to restore the original.");
        if (text.Length > MaxTextLength)
            throw new DomainException($"A label cannot exceed {MaxTextLength} characters.");
        return text;
    }
}
