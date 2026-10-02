using System.Text;
using System.Text.RegularExpressions;
using Ganss.Xss;

namespace QuizMaster.Domain.Questions;

// String-only HTML helpers for Explain questions (port of the app's shared/explain-question.ts).
// Nothing here parses a DOM: the same flattening must run in the grader, the authoring validator and tests.
public static partial class HtmlText
{
    // Ceiling for one authored HTML field, in UTF-8 bytes: a paste-bomb fails validation with a readable message.
    public const int MaxFieldBytes = 512 * 1024;

    // Applied in this order, exactly as the app does (so "&amp;lt;" decodes to "<").
    private static readonly (string Entity, string Character)[] NamedEntities =
    [
        ("&nbsp;", " "),
        ("&amp;", "&"),
        ("&lt;", "<"),
        ("&gt;", ">"),
        ("&quot;", "\""),
        ("&#39;", "'"),
        ("&apos;", "'"),
    ];

    [GeneratedRegex(@"<\/?(p|div|br|li|tr|h[1-6]|blockquote|pre)\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex BlockLevelTag();

    [GeneratedRegex("<[^>]*>")]
    private static partial Regex AnyTag();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    // Block-level tags become spaces ("<p>a</p><p>b</p>" reads "a b"), other tags are dropped,
    // the entities an editor emits are decoded, and whitespace is collapsed.
    public static string PlainText(string? html)
    {
        if (string.IsNullOrEmpty(html))
            return string.Empty;

        var text = AnyTag().Replace(BlockLevelTag().Replace(html, " "), string.Empty);
        foreach (var (entity, character) in NamedEntities)
            text = text.Replace(entity, character, StringComparison.Ordinal);

        return Whitespace().Replace(text, " ").Trim();
    }

    // An empty editor still reports markup like "<p><br></p>", so emptiness is decided on the flattened text.
    public static bool HasContent(string? html) => PlainText(html).Length > 0;

    public static bool ExceedsFieldLimit(string? value) => Encoding.UTF8.GetByteCount(value ?? string.Empty) > MaxFieldBytes;

    //insight - rich text is stored as the HTML the editor produced, and some screens put it back into a live editor.
    // Cleaning it on the way in (scripts, event handlers, javascript: links, <iframe>/<object>/<form> all removed;
    // formatting, lists and tables kept) means stored HTML is safe for any consumer, not only the ones that sanitize
    // on display. One shared instance: Sanitize is thread-safe once configured.
    private static readonly HtmlSanitizer Sanitizer = new();

    public static string? Clean(string? html) => string.IsNullOrEmpty(html) ? html : Sanitizer.Sanitize(html);
}
