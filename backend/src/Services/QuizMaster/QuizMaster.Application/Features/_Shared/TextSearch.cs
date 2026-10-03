namespace QuizMaster.Application.Features.Shared;

// Free-text search, as SQL LIKE '%term%': the one place a typed search becomes a pattern. The term's own wildcards
// (% _ [) are escaped, so "50%" finds "50%" rather than everything that starts with "50". Pass EscapeCharacter to
// EF.Functions.Like with the pattern.
public static class TextSearch
{
    public const string EscapeCharacter = "\\";

    public static string? ContainsPattern(string? search)
    {
        if (string.IsNullOrWhiteSpace(search))
            return null;

        var escaped = search.Trim()
            .Replace(EscapeCharacter, EscapeCharacter + EscapeCharacter)
            .Replace("%", EscapeCharacter + "%")
            .Replace("_", EscapeCharacter + "_")
            .Replace("[", EscapeCharacter + "[");
        return $"%{escaped}%";
    }
}
