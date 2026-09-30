namespace QuizMaster.Domain.Participations;

// One graded attempt at a quiz. Written only by Submit (never by the client), then marked and validated by a teacher.
public partial class Participation : AggregateRoot, IMultitenancy
{
    private Participation() {}                                   // use Participation.Submit(...)

    public int TenantId { get; set; }
    public ParticipationType Type { get; private set; }

    // What was sat. Names are snapshotted: the quiz or assignment may be renamed or deleted later.
    public int? BankQuizId { get; private set; }
    public int? TeacherQuizId { get; private set; }
    public string QuizName { get; private set; } = null!;
    public int? HomeworkId { get; private set; }
    public string? HomeworkTitle { get; private set; }

    // Who sat it, and who reviews it (the assignment's author, or the bank quiz's reviewer).
    public int ChildId { get; private set; }
    public int? ParentId { get; private set; }
    public int? ReviewerId { get; private set; }
    public int? StageId { get; private set; }
    public int? GradeId { get; private set; }
    public int? ClassId { get; private set; }

    public int Score { get; private set; }                       // correct auto-graded questions (a count)
    public int ScorePercent { get; private set; }                // weighted 0–100, rises as a teacher marks answers
    public int CorrectCount { get; private set; }
    public int WrongCount { get; private set; }
    public int PendingReviewCount { get; private set; }          // answers still waiting for a teacher's mark

    public DateTime StartedOn { get; private set; }
    public DateTime EndedOn { get; private set; }                // always stamped by the server

    // The teacher's verdict on the whole submission, when one has been recorded.
    public ValidationStatus? ValidationStatus { get; private set; }
    public string? ValidationFeedback { get; private set; }
    public int? ValidatedById { get; private set; }
    public DateTime? ValidatedOn { get; private set; }

    private readonly List<ParticipationAnswer> _answers = new();
    public IReadOnlyList<ParticipationAnswer> Answers => _answers.AsReadOnly();

    public bool IsRejected => ValidationStatus == Participations.ValidationStatus.Rejected;
}
