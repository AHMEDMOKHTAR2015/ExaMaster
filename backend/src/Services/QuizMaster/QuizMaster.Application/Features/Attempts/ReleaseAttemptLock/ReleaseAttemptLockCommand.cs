namespace QuizMaster.Application.Features.Attempts.ReleaseAttemptLock;

// A teacher lets the student back in: the attempt resumes. Only staff (or a graded submission) can release a lock.
public record ReleaseAttemptLockCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.ReleaseAttemptLock;
}

public class ReleaseAttemptLockCommandValidator : QuizMasterCommandValidator<ReleaseAttemptLockCommand>;
