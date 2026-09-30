namespace QuizMaster.Domain.AttemptLocks;

public partial class QuizAttemptLock
{
    // Opening an attempt: a new lock, or a fresh start on one a teacher released. A blocking lock refuses entry.
    public static QuizAttemptLock Begin(
        User student, AttemptedQuiz quiz, HomeworkAssignment? homework, QuizAttemptLock? existing, IQuizMasterAction action)
    {
        if (!quiz.Settings.OneTimeJoin)
            throw new DomainException("This quiz is not a One Time Join quiz, so it needs no attempt lock.");

        homework?.EnsureOpenFor(student);

        if (existing is { IsBlocking: true })
            throw new DomainException("You already started this quiz and left it. Ask your teacher to unlock it.");

        var attemptLock = existing ?? new QuizAttemptLock
        {
            ChildId = student.Id,
            ScopeKey = AttemptScope.KeyFor(quiz, homework),
            CreatedById = action.CreatedById,
            CreatedOn = action.CreatedOn
        };

        // A full reset, not a merge: an entry after a release starts clean instead of inheriting the old exit count.
        attemptLock.BankQuizId = quiz.BankQuizId;
        attemptLock.TeacherQuizId = quiz.TeacherQuizId;
        attemptLock.HomeworkId = homework?.Id;
        attemptLock.QuizName = quiz.Name;
        attemptLock.ReviewerId = homework?.CreatedById ?? quiz.ReviewerId;
        attemptLock.ClassId = student.ClassId;
        attemptLock.Status = AttemptLockStatus.InProgress;
        attemptLock.StartedOn = action.CreatedOn;
        attemptLock.LockedOn = null;
        attemptLock.ExitAttempts = 0;
        attemptLock.LastExitReason = null;
        attemptLock.ReleasedOn = null;
        attemptLock.ReleasedById = null;
        (attemptLock.LastModifiedById, attemptLock.LastModifiedOn) = (action.CreatedById, action.CreatedOn);

        return attemptLock;
    }

    // Bookkeeping for the teacher, not what blocks re-entry. An exit reported after the lock was released
    // (a tab closing after the submission) changes nothing: it must not lock the student out of their next attempt.
    public void RecordExit(AttemptExitReason reason, IQuizMasterAction action)
    {
        if (!IsBlocking)
            return;

        Status = AttemptLockStatus.Locked;
        LockedOn = action.CreatedOn;
        ExitAttempts++;
        LastExitReason = reason;
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    // A teacher letting the student back in: the attempt resumes.
    public void Release(IQuizMasterAction action)
    {
        Status = AttemptLockStatus.Released;
        ReleasedOn = action.CreatedOn;
        ReleasedById = action.CreatedById;
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    // Finishing the attempt is what lifts the lock; it is saved in the same transaction as the graded submission,
    // so a submission that commits always leaves the student unlocked and one that fails never does.
    public void ReleaseOnSubmission(IQuizMasterAction action)
    {
        Status = AttemptLockStatus.Released;
        ReleasedOn = action.CreatedOn;
        ReleasedById = null;
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }
}
