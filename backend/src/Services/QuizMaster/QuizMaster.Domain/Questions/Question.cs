namespace QuizMaster.Domain.Questions;

// A question in the organization's shared bank, authored by an application administrator.
public partial class Question : AggregateRoot, IMultitenancy, IQuestionDefinition
{
    private Question() {}                                        // use Question.Create(...)

    public int TenantId { get; set; }

    public QuestionType Type { get; private set; }
    public string Name { get; private set; } = null!;
    public IReadOnlyList<QuestionOption> Options { get; private set; } = [];
    public IReadOnlyList<CompleteSegment> Segments { get; private set; } = [];
    public string? SubjectHtml { get; private set; }
    public double? WeightPercent { get; private set; }
    public int? DurationSeconds { get; private set; }

    //insight - the answer key sits on the aggregate, but no student-facing DTO has a member it could be mapped into:
    // the "sitting" shapes are built from the display fields only (see the Application's SittingDtos)
    public int? CorrectOptionId { get; private set; }
    public IReadOnlyList<string>? CorrectBlanks { get; private set; }
    public string? ReferenceAnswer { get; private set; }

    // Classification, used to filter the bank.
    public int? SubjectId { get; private set; }
    public int? StageId { get; private set; }
    public int? GradeId { get; private set; }
    public Semester? Semester { get; private set; }
    public IReadOnlyList<int> TagIds { get; private set; } = [];  // tags of its subject (SubjectTag ids)

    public int QuestionId => Id;
    public AnswerKey Key => new(CorrectOptionId, CorrectBlanks, ReferenceAnswer);
}
