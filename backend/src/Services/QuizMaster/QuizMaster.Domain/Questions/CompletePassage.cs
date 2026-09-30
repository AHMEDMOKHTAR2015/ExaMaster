namespace QuizMaster.Domain.Questions;

// Fill-in-the-blank passages (port of the app's shared/complete-question.ts).
// Authors mark a blank by writing "(Complete)" right after its keyword: "The capital is Paris(Complete)."
public static class CompletePassage
{
    public const string Marker = "(Complete)";
    public const string BlankPlaceholder = "_____";

    // Splits authored text into segments (static text + blanks) and the correct keyword per blank.
    // The keyword is the last whitespace-delimited token before each marker; the text before it stays static.
    public static (IReadOnlyList<CompleteSegment> Segments, IReadOnlyList<string> Keywords) Parse(string raw)
    {
        if (raw.IndexOf(Marker, StringComparison.Ordinal) == -1)
            throw new DomainException($"A Complete question needs at least one blank: write {Marker} right after each keyword.");

        var segments = new List<CompleteSegment>();
        var keywords = new List<string>();
        var cursor = 0;

        while (true)
        {
            var markerStart = raw.IndexOf(Marker, cursor, StringComparison.Ordinal);
            if (markerStart == -1)
            {
                var tail = raw[cursor..];
                if (tail.Length > 0)
                    segments.Add(CompleteSegment.ForText(tail));
                break;
            }

            var chunk = raw[cursor..markerStart].TrimEnd();
            if (chunk.Length == 0)
                throw new DomainException($"Every {Marker} marker must follow a keyword.");

            var lastWhitespace = LastWhitespaceIndex(chunk);
            var keyword = lastWhitespace == -1 ? chunk : chunk[(lastWhitespace + 1)..];
            var leadingText = lastWhitespace == -1 ? string.Empty : chunk[..(lastWhitespace + 1)];

            if (leadingText.Length > 0)
                segments.Add(CompleteSegment.ForText(leadingText));
            segments.Add(CompleteSegment.ForBlank(keywords.Count, keyword.Length));
            keywords.Add(keyword);

            cursor = markerStart + Marker.Length;
        }

        return (segments, keywords);
    }

    // The stored, masked display text: never reveals a keyword or its length.
    public static string RenderPreview(IEnumerable<CompleteSegment> segments)
        => string.Concat(segments.Select(segment => segment.IsBlank ? BlankPlaceholder : segment.Text));

    // Rebuilds authorable text for the editing form (round-trip parseable, not byte-identical).
    public static string Reconstruct(IEnumerable<CompleteSegment> segments, IReadOnlyList<string> keywords)
        => string.Concat(segments.Select(segment => segment.IsBlank
            ? $"{(segment.Index < keywords.Count ? keywords[segment.Index!.Value] : string.Empty)}{Marker}"
            : segment.Text));

    // Canonical comparison form of a typed answer: trimmed and lower-cased.
    public static string Normalize(string? value) => Trim(value).ToLowerInvariant();

    // JavaScript's String.prototype.trim: whitespace AND the byte-order mark, which .NET does not count as whitespace.
    internal static string Trim(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return string.Empty;

        var start = 0;
        var end = value.Length - 1;
        while (start <= end && IsTrimmable(value[start])) start++;
        while (end >= start && IsTrimmable(value[end])) end--;
        return value[start..(end + 1)];

        static bool IsTrimmable(char c) => char.IsWhiteSpace(c) || c == '﻿';
    }

    private static int LastWhitespaceIndex(string text)
    {
        for (var i = text.Length - 1; i >= 0; i--)
            if (char.IsWhiteSpace(text[i]))
                return i;
        return -1;
    }
}
