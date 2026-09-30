namespace QuizMaster.Domain.AttemptLocks;

public enum AttemptLockStatus
{
    InProgress = 1,   // the student confirmed the warning and opened the quiz: already blocks a second entry
    Locked = 2,       // the client saw them leave; same blocking effect, tells the teacher THAT they left
    Released = 3,     // the attempt was submitted, or a teacher let them back in: the only status a student never sets
}
