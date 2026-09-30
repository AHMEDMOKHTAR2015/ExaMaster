namespace QuizMaster.Domain.TeacherQuizzes;

// A quiz a teacher authored from scratch for their own classes (as opposed to one from the shared bank).
// Its questions are private to it, so they live inside the aggregate. The author (CreatedById) owns it.
public partial class TeacherQuiz : AggregateRoot, IMultitenancy
{
    private TeacherQuiz() {}                                     // use TeacherQuiz.Create(...)

    public int TenantId { get; set; }
    public string Name { get; private set; } = null!;
    public string Description { get; private set; } = string.Empty;
    public QuizSettings Settings { get; private set; } = QuizSettings.Default;

    public int SubjectId { get; private set; }
    public int? StageId { get; private set; }                    // narrows bank suggestions in the builder
    public Semester? Semester { get; private set; }

    private readonly List<TeacherQuizQuestion> _questions = new();
    public IReadOnlyList<TeacherQuizQuestion> Questions => _questions.AsReadOnly();
}
