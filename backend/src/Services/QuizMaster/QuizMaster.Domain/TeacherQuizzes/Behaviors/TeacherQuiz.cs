namespace QuizMaster.Domain.TeacherQuizzes;

public partial class TeacherQuiz
{
    public const int MaxNameLength = MaxLength.C256;
    public const int MaxDescriptionLength = MaxLength.C2048;
    public const int MaxQuestions = 200;

    public static TeacherQuiz Create(
        string name, string? description, QuizSettings settings, Subject subject, int? stageId, Semester? semester,
        IReadOnlyList<AuthoredQuestion> questions, IQuizMasterAction action)
    {
        var quiz = new TeacherQuiz { CreatedById = action.CreatedById, CreatedOn = action.CreatedOn };
        quiz.Apply(name, description, settings, subject, stageId, semester, questions);
        return quiz;
    }

    public void Update(
        string name, string? description, QuizSettings settings, Subject subject, int? stageId, Semester? semester,
        IReadOnlyList<AuthoredQuestion> questions, IQuizMasterAction action)
    {
        Apply(name, description, settings, subject, stageId, semester, questions);
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    public bool IsOwnedBy(int userId) => CreatedById == userId;

    // A teacher quiz reaches students through an assignment, whose author reviews it: it names no reviewer of its own.
    public AttemptedQuiz ForAttempt()
        => new(null, Id, Name, Settings, ReviewerId: null,
            _questions.OrderBy(question => question.Number).Cast<IQuestionDefinition>().ToList());

    private void Apply(
        string name, string? description, QuizSettings settings, Subject subject, int? stageId, Semester? semester,
        IReadOnlyList<AuthoredQuestion> questions)
    {
        var trimmedName = name?.Trim();
        if (string.IsNullOrEmpty(trimmedName) || trimmedName.Length > MaxNameLength)
            throw new DomainException($"A quiz needs a name of at most {MaxNameLength} characters.");
        if (description?.Length > MaxDescriptionLength)
            throw new DomainException($"A quiz description cannot exceed {MaxDescriptionLength} characters.");

        settings.EnsureValid();

        if (questions.Count == 0)
            throw new DomainException("A quiz needs at least one question.");
        if (questions.Count > MaxQuestions)
            throw new DomainException($"A quiz cannot have more than {MaxQuestions} questions.");

        // Numbers are 1..n in authored order; they are also the ids the weighting is keyed by.
        QuizScoring.EnsureValidExplainWeights(
            questions.Select((question, i) => new WeightableQuestion(i + 1, question.Type, question.WeightPercent)).ToList());

        Name = trimmedName;
        Description = description?.Trim() ?? string.Empty;
        Settings = settings;
        (SubjectId, StageId, Semester) = (subject.Id, stageId, semester);

        _questions.Clear();
        _questions.AddRange(questions.Select((question, i) => TeacherQuizQuestion.Create(question, i + 1)));
    }
}
