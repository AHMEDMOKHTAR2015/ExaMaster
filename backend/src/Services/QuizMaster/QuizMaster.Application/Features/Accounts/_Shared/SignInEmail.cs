using System.Text.RegularExpressions;

namespace QuizMaster.Application.Features.Accounts.Shared;

// Families sign in with a mobile number; sign-in is by email. The app's EmailBuilder joined
// the two as "{digits}@mobile.local", and every existing account was created that way, so the rule must not change.
//insight - not namespaced by organization (see the app's CLAUDE.md): a mobile number is unique platform-wide, and the
// second school to register one gets a conflict
public static partial class SignInEmail
{
    public const string MobileDomain = "mobile.local";
    public const int MinimumMobileDigits = 4;

    public const string MobileNumberMessage = "A mobile number must have at least 4 digits.";

    public static string ForMobile(string mobileNumber)
    {
        if (!HasEnoughDigits(mobileNumber))
            throw new BadRequestException(MobileNumberMessage);
        return $"{NonDigits().Replace(mobileNumber, "")}@{MobileDomain}";
    }

    // An explicit email wins (staff often have one); otherwise the mobile number is the sign-in.
    public static string For(string? email, string mobileNumber)
        => string.IsNullOrWhiteSpace(email) ? ForMobile(mobileNumber) : email.Trim().ToLowerInvariant();

    public static bool HasEnoughDigits(string? mobileNumber)
        => mobileNumber is not null && NonDigits().Replace(mobileNumber, "").Length >= MinimumMobileDigits;

    public static string DisplayName(string firstName, string lastName) => $"{firstName.Trim()} {lastName.Trim()}".Trim();

    [GeneratedRegex(@"\D")]
    private static partial Regex NonDigits();
}
