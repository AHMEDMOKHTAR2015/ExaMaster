namespace QuizMaster.Domain.AttemptLocks;

// Why the browser believes the student left. FullscreenExit counts because, on a desktop browser, it is the
// necessary first step to reach another tab.
public enum AttemptExitReason
{
    Closed = 1,
    Hidden = 2,
    Navigated = 3,
    FullscreenExit = 4,
}
