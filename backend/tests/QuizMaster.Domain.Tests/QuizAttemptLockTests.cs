using static QuizMaster.Domain.Tests.TestData;

namespace QuizMaster.Domain.Tests;

public class QuizAttemptLockTests
{
    private static readonly ClassGroup StudentsClass = Class();
    private static readonly AttemptedQuiz OneTimeJoinQuiz = Quiz(new QuizSettings { OneTimeJoin = true }, Choose(1));

    private static QuizAttemptLock Begin(QuizAttemptLock? existing = null, HomeworkAssignment? homework = null)
        => QuizAttemptLock.Begin(Student(StudentsClass), OneTimeJoinQuiz, homework, existing, Action(QuizMasterActionType.StartAttempt, StudentId));

    [Fact]
    public void Opening_an_attempt_writes_a_blocking_lock_immediately()
    {
        var attemptLock = Begin();

        Assert.Equal(AttemptLockStatus.InProgress, attemptLock.Status);
        Assert.True(attemptLock.IsBlocking);
        Assert.Equal("bank:100", attemptLock.ScopeKey);
        Assert.Equal(StudentId, attemptLock.ChildId);
    }

    [Fact]
    public void The_assignment_is_the_scope_when_there_is_one()
        => Assert.Equal("homework:300", Begin(homework: Homework(StudentsClass)).ScopeKey);

    [Fact]
    public void A_student_cannot_re_enter_a_blocking_attempt()
    {
        var attemptLock = Begin();
        attemptLock.RecordExit(AttemptExitReason.Hidden, Action(QuizMasterActionType.RecordAttemptExit, StudentId));

        Assert.Equal(AttemptLockStatus.Locked, attemptLock.Status);
        Assert.Equal(1, attemptLock.ExitAttempts);
        Assert.Throws<DomainException>(() => Begin(existing: attemptLock));
    }

    [Fact]
    public void A_teacher_release_lets_the_student_start_again_from_a_clean_record()
    {
        var attemptLock = Begin();
        attemptLock.RecordExit(AttemptExitReason.Closed, Action(QuizMasterActionType.RecordAttemptExit, StudentId));
        attemptLock.Release(Action(QuizMasterActionType.ReleaseAttemptLock, TeacherId));

        Assert.Equal(TeacherId, attemptLock.ReleasedById);
        var reopened = Begin(existing: attemptLock);

        Assert.Same(attemptLock, reopened);
        Assert.Equal(AttemptLockStatus.InProgress, reopened.Status);
        Assert.Equal(0, reopened.ExitAttempts);
        Assert.Null(reopened.ReleasedById);
    }

    [Fact]
    public void An_exit_reported_after_the_submission_changes_nothing()
    {
        var attemptLock = Begin();
        attemptLock.ReleaseOnSubmission(Action(QuizMasterActionType.SubmitQuiz, StudentId));

        attemptLock.RecordExit(AttemptExitReason.Closed, Action(QuizMasterActionType.RecordAttemptExit, StudentId));

        Assert.Equal(AttemptLockStatus.Released, attemptLock.Status);
        Assert.Null(attemptLock.ReleasedById);                 // released by the system, not a teacher
        Assert.Equal(0, attemptLock.ExitAttempts);
    }

    [Fact]
    public void Only_a_One_Time_Join_quiz_takes_a_lock()
        => Assert.Throws<DomainException>(() => QuizAttemptLock.Begin(
            Student(StudentsClass), Quiz(Choose(1)), null, null, Action(QuizMasterActionType.StartAttempt, StudentId)));
}
