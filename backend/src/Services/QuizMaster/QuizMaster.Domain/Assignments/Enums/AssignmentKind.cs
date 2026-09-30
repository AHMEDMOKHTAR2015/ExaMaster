namespace QuizMaster.Domain.Assignments;

// Quiz and homework assignments share one pipeline; the kind only labels which one a record is.
public enum AssignmentKind
{
    Homework = 1,
    Quiz = 2,
}
