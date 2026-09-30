namespace QuizMaster.Domain.AttemptLocks;

// Which piece of work an attempt belongs to. The assignment wins when there is one: a homework and a practice run
// of the same quiz are separate attempts, and unlocking one must not silently unlock the other.
public static class AttemptScope
{
    public static string KeyFor(AttemptedQuiz quiz, HomeworkAssignment? homework)
    {
        if (homework is not null)
            return $"homework:{homework.Id}";
        if (quiz.TeacherQuizId is { } teacherQuizId)
            return $"teacher:{teacherQuizId}";
        return $"bank:{quiz.BankQuizId ?? 0}";
    }
}
