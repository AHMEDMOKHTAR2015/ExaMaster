using System.Text.RegularExpressions;

namespace QuizMaster.Domain.Academic;

internal static class AcademicRules
{
    public const int MaxNameLength = MaxLength.C128;

    public static readonly Regex HexColor = new("^#[0-9a-fA-F]{6}$", RegexOptions.Compiled);
    public static readonly Regex Email = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static string RequiredName(string name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed))
            throw new DomainException("A name is required.");
        if (trimmed.Length > MaxNameLength)
            throw new DomainException($"A name cannot exceed {MaxNameLength} characters.");
        return trimmed;
    }

    public static int NonNegativeOrder(int order)
        => order >= 0 ? order : throw new DomainException("The display order cannot be negative.");
}
