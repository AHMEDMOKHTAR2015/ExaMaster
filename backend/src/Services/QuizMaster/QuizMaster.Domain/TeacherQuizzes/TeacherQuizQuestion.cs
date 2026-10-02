namespace QuizMaster.Domain.TeacherQuizzes;

// One question of a teacher quiz. Created only through TeacherQuiz, which enforces the quiz-wide rules.
public class TeacherQuizQuestion : Entity, IQuestionDefinition
{
    private TeacherQuizQuestion() {}

    public int TeacherQuizId { get; private set; }

    //insight - responses and participation answers refer to Number, not to the row id: numbers are positional (1..n)
    // and survive the quiz being edited, while rows are replaced on every save
    public int Number { get; private set; }

    public QuestionType Type { get; private set; }
    public string Name { get; private set; } = null!;
    public IReadOnlyList<QuestionOption> Options { get; private set; } = [];
    public IReadOnlyList<CompleteSegment> Segments { get; private set; } = [];
    public string? SubjectHtml { get; private set; }
    public double? WeightPercent { get; private set; }
    public int? DurationSeconds { get; private set; }

    public int? CorrectOptionId { get; private set; }
    public IReadOnlyList<string>? CorrectBlanks { get; private set; }
    public string? ReferenceAnswer { get; private set; }

    public IReadOnlyList<int> TagIds { get; private set; } = [];  // tags of the quiz's subject

    public int QuestionId => Number;
    public AnswerKey Key => new(CorrectOptionId, CorrectBlanks, ReferenceAnswer);

    internal static TeacherQuizQuestion Create(AuthoredQuestion authored, QuestionTags tags, int number) => new()
    {
        TagIds = tags.TagIds,
        Number = number,
        Type = authored.Type,
        Name = authored.Name,
        Options = authored.Options,
        Segments = authored.Segments,
        SubjectHtml = authored.SubjectHtml,
        WeightPercent = authored.WeightPercent,
        DurationSeconds = authored.DurationSeconds,
        CorrectOptionId = authored.Key.CorrectOptionId,
        CorrectBlanks = authored.Key.CorrectBlanks,
        ReferenceAnswer = authored.Key.ReferenceAnswer
    };

    internal bool Untag(IReadOnlyCollection<int> tagIds)
    {
        if (!TagIds.Intersect(tagIds).Any())
            return false;
        TagIds = TagIds.Except(tagIds).ToList();
        return true;
    }
}
