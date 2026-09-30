namespace QuizMaster.Domain.Assignments;

// A quiz a teacher (or administrator) set for a class, or for named students of it, with a due date.
// Its author (CreatedById) reviews the submissions.
public partial class HomeworkAssignment : AggregateRoot, IMultitenancy
{
    private HomeworkAssignment() {}                              // use HomeworkAssignment.Create(...)

    public int TenantId { get; set; }
    public string Title { get; private set; } = null!;
    public AssignmentKind Kind { get; private set; }

    public QuizSource Source { get; private set; }
    public int? BankQuizId { get; private set; }                 // set when Source is Bank
    public int? TeacherQuizId { get; private set; }              // set when Source is Custom

    public int StageId { get; private set; }                     // derived from the class
    public int? GradeId { get; private set; }
    public int ClassId { get; private set; }
    public int? SubjectId { get; private set; }
    public Semester? Semester { get; private set; }

    public DateTime DueAt { get; private set; }
    public bool IsActive { get; private set; }

    // When non-empty, only these students receive it; empty means the whole class (and, as in the app, the stage).
    public IReadOnlyList<int> AssignedChildIds { get; private set; } = [];
}
