namespace QuizMaster.Application.Features.Users.Shared;

// How recently someone has used the app, as the Users table shows it (the client's getStatus): a deactivated account is
// Suspended; one that has never signed in is Pending; one not seen for InactiveAfter is Inactive; anyone else is Active.
public enum UserActivity
{
    Active = 1,
    Pending = 2,
    Inactive = 3,
    Suspended = 4,
}

// The Users table's filters, written once as queries so every list of people narrows the same way.
public static class UserFilters
{
    public static readonly TimeSpan InactiveAfter = TimeSpan.FromDays(14);

    // name, email or mobile number, as the search box promises
    public static IQueryable<User> MatchingSearch(this IQueryable<User> users, string? search)
        => TextSearch.ContainsPattern(search) is { } pattern
            ? users.Where(user => EF.Functions.Like(user.DisplayName, pattern, TextSearch.EscapeCharacter)
                || EF.Functions.Like(user.Email, pattern, TextSearch.EscapeCharacter)
                || EF.Functions.Like(user.MobileNumber!, pattern, TextSearch.EscapeCharacter))
            : users;

    public static IQueryable<User> WithActivity(this IQueryable<User> users, UserActivity activity, DateTime now)
    {
        var seenSince = now - InactiveAfter;
        return activity switch
        {
            UserActivity.Suspended => users.Where(user => !user.IsActive),
            UserActivity.Pending => users.Where(user => user.IsActive && user.LastActiveOn == null),
            UserActivity.Inactive => users.Where(user => user.IsActive && user.LastActiveOn != null && user.LastActiveOn < seenSince),
            _ => users.Where(user => user.IsActive && user.LastActiveOn != null && user.LastActiveOn >= seenSince)
        };
    }
}
