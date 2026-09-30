namespace QuizMaster.Domain.Quizzes;

// How a quiz is sat (the app's QuizConfig). Shared by bank quizzes and teacher-authored quizzes.
//insight - a class, not a record: the ValueObject base type defines value equality and a record would override it
public sealed class QuizSettings : ValueObject
{
    public const int MaxDurationSeconds = 6 * 60 * 60;
    public const int MaxPageSize = 100;

    public static QuizSettings Default => new();

    public bool AllowBack { get; init; } = true;
    public bool AllowReview { get; init; } = true;
    public bool AutoMove { get; init; }                          // move on as soon as a question is answered
    public int DurationSeconds { get; init; }                    // time for the whole quiz; 0 = unlimited
    public int PageSize { get; init; } = 1;
    public bool RequiredAll { get; init; }                       // every question must be answered to submit (enforced on submit)
    public bool RichText { get; init; }
    public bool ShuffleQuestions { get; init; }
    public bool ShuffleOptions { get; init; }
    public bool ShowClock { get; init; } = true;
    public bool ShowPager { get; init; } = true;
    public bool OneTimeJoin { get; init; }                       // one uninterrupted sitting, enforced by QuizAttemptLock
    public string? ImagePath { get; init; }                      // cover image, a build-time asset path

    public void EnsureValid()
    {
        if (DurationSeconds is < 0 or > MaxDurationSeconds)
            throw new DomainException($"A quiz's duration must be between 0 (unlimited) and {MaxDurationSeconds} seconds.");
        if (PageSize is < 1 or > MaxPageSize)
            throw new DomainException($"A quiz's page size must be between 1 and {MaxPageSize}.");
        if (ImagePath?.Length > MaxLength.C256)
            throw new DomainException($"An image path cannot exceed {MaxLength.C256} characters.");
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return AllowBack;
        yield return AllowReview;
        yield return AutoMove;
        yield return DurationSeconds;
        yield return PageSize;
        yield return RequiredAll;
        yield return RichText;
        yield return ShuffleQuestions;
        yield return ShuffleOptions;
        yield return ShowClock;
        yield return ShowPager;
        yield return OneTimeJoin;
        yield return ImagePath;
    }
}
