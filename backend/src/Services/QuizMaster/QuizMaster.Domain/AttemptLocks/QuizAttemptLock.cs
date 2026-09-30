namespace QuizMaster.Domain.AttemptLocks;

// "One Time Join" containment: one student's single, uninterrupted sitting of one piece of work.
//insight - the lock is written when the attempt OPENS, not when it ends: re-entry is denied by the absence of a release,
// so a killed tab, a dropped connection or a closed laptop all fail in the safe direction. Everything the browser does
// to keep a student inside is advisory; this record is not, because only a submission or a teacher can release it.
public partial class QuizAttemptLock : AggregateRoot, IMultitenancy
{
    private QuizAttemptLock() {}                                 // use QuizAttemptLock.Begin(...)

    public int TenantId { get; set; }
    public int ChildId { get; private set; }
    public string ScopeKey { get; private set; } = null!;       // one lock per (student, scope): see AttemptScope

    // Denormalized so a teacher's list needs no joins.
    public int? BankQuizId { get; private set; }
    public int? TeacherQuizId { get; private set; }
    public int? HomeworkId { get; private set; }
    public string QuizName { get; private set; } = null!;
    public int? ReviewerId { get; private set; }
    public int? ClassId { get; private set; }

    public AttemptLockStatus Status { get; private set; }
    public DateTime StartedOn { get; private set; }
    public DateTime? LockedOn { get; private set; }
    public int ExitAttempts { get; private set; }                // every observed exit, not just the first
    public AttemptExitReason? LastExitReason { get; private set; }
    public DateTime? ReleasedOn { get; private set; }
    public int? ReleasedById { get; private set; }               // null on a released lock = released by the submission

    public bool IsBlocking => Status != AttemptLockStatus.Released;
}
