namespace QuizMaster.Domain.Quizzes;

// A quiz in the organization's shared bank: an ordered selection of bank questions, authored by an application administrator.
// Students start it straight off their own list, so nobody assigns it; ReviewerId names who marks its Explain/Complete answers.
public partial class BankQuiz : AggregateRoot, IMultitenancy
{
    private BankQuiz() {}                                        // use BankQuiz.Create(...)

    public int TenantId { get; set; }
    public string Name { get; private set; } = null!;
    public string Description { get; private set; } = string.Empty;
    public QuizSettings Settings { get; private set; } = QuizSettings.Default;

    public int? SubjectId { get; private set; }
    public int? StageId { get; private set; }
    public int? GradeId { get; private set; }
    public int? ClassId { get; private set; }
    public Semester? Semester { get; private set; }

    // A teacher's user id: who marks this quiz's Explain/Complete answers.
    public int? ReviewerId { get; private set; }

    private readonly List<BankQuizQuestion> _questions = new();
    public IReadOnlyList<BankQuizQuestion> Questions => _questions.AsReadOnly();
}
