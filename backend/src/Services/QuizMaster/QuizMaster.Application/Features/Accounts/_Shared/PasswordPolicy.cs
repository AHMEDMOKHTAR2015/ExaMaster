namespace QuizMaster.Application.Features.Accounts.Shared;

// The rule every NEW password is held to (OWASP ASVS V2.1): at least 8 characters, up to 128 so passphrases fit, any
// characters at all, no composition rules (they push people to "Password1!"), and never one of the passwords attackers
// try first. A password set before the rule tightened still signs in: sign-in never checks the rule, only setting one does.
public static class PasswordPolicy
{
    public const int MinimumLength = 8;
    public const int MaximumLength = MaxLength.C128;

    public const string TooShortMessage = "A password must be at least 8 characters.";
    public const string TooCommonMessage = "That password is too common and easy to guess. Choose another one.";

    public static IRuleBuilderOptions<T, string?> MustBeAcceptablePassword<T>(this IRuleBuilder<T, string?> rule)
        => rule
            .Must(password => password is not null && password.Length >= MinimumLength).WithMessage(TooShortMessage)
            .MaximumLength(MaximumLength)
            .Must(password => password is null || !IsCommon(password)).WithMessage(TooCommonMessage);

    // Case-insensitive: "PASSWORD1" is no stronger than "password1".
    public static bool IsCommon(string password)
    {
        var lowered = password.Trim().ToLowerInvariant();
        return CommonPasswords.Contains(lowered) || IsOneRepeatedCharacter(lowered) || IsDigitRun(lowered);
    }

    private static bool IsOneRepeatedCharacter(string password) => password.Length > 0 && password.All(c => c == password[0]);

    // 12345678, 98765432, 0123456789: consecutive digits, up or down.
    private static bool IsDigitRun(string password)
    {
        if (password.Length < 2 || !password.All(char.IsAsciiDigit))
            return false;
        var step = password[1] - password[0];
        if (step is not (1 or -1))
            return false;
        for (var i = 2; i < password.Length; i++)
            if (password[i] - password[i - 1] != step)
                return false;
        return true;
    }

    // The most-used passwords of 8+ characters from public breach corpora (shorter ones already fail the length rule),
    // plus this app's own names.
    private static readonly HashSet<string> CommonPasswords = new(StringComparer.Ordinal)
    {
        "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword", "pa$$w0rd",
        "12345678", "123456789", "1234567890", "12341234", "11223344", "12121212", "13131313", "11112222", "12344321",
        "123123123", "147258369", "159753456", "741852963", "789456123", "987654321a", "123456789a", "1234567a", "12345678a",
        "1q2w3e4r", "1q2w3e4r5t", "1qaz2wsx", "1qazxsw2", "zaq12wsx", "zaq1zaq1", "q1w2e3r4", "q1w2e3r4t5", "a1b2c3d4",
        "qwertyui", "qwertyuiop", "qwerty12", "qwerty123", "qwerty1234", "asdfghjk", "asdfghjkl", "zxcvbnm1", "qweasdzxc",
        "123qweasd", "12qwaszx", "abc12345", "abcd1234", "abcdefgh", "aa123456", "abc123456",
        "iloveyou", "iloveyou1", "sunshine", "princess", "football", "baseball", "basketball", "superman", "batman123",
        "starwars", "whatever", "trustno1", "letmein1", "welcome1", "welcome123", "admin123", "administrator", "michael1",
        "computer", "internet", "jennifer", "jordan23", "liverpool", "chelsea1", "arsenal1", "barcelona", "realmadrid",
        "midnight", "charlie1", "dragon12", "monkey12", "master12", "shadow12", "freedom1", "hello123", "loveyou1",
        "changeme", "changeme1", "secret12", "default1", "qazwsxedc", "mustang1", "pokemon1", "minecraft", "fuckyou1",
        "00000000", "11111111", "88888888", "66666666", "12345679", "87654321",
        "quizmaster", "quizmaster1", "examaster", "examaster1", "school123", "student1", "student123", "teacher1",
        "teacher123", "parent123", "egypt123", "cairo123",
    };
}
