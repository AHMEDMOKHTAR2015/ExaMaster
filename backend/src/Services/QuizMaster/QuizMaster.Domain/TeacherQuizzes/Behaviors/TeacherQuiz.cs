namespace QuizMaster.Domain.TeacherQuizzes;

public partial class TeacherQuiz
{
    public const int MaxNameLength = MaxLength.C256;
    public const int MaxDescriptionLength = MaxLength.C2048;
    public const int MaxQuestions = 200;

    public static TeacherQuiz Create(
        string name, string? description, QuizSettings settings, Subject subject, int? stageId, Semester? semester,
        IReadOnlyList<TaggedQuestion> questions, IQuizMasterAction action)
    {
        var quiz = new TeacherQuiz { CreatedById = action.CreatedById, CreatedOn = action.CreatedOn };
        quiz.Apply(name, description, settings, subject, stageId, semester, questions);
        return quiz;
    }

    public void Update(
        string name, string? description, QuizSettings settings, Subject subject, int? stageId, Semester? semester,
        IReadOnlyList<TaggedQuestion> questions, IQuizMasterAction action)
    {
        Apply(name, description, settings, subject, stageId, semester, questions);
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    public bool IsOwnedBy(int userId) => CreatedById == userId;

    // Its subject deleted these tags: nothing in the database removes them from the questions' JSON lists.
    public void Untag(IReadOnlyCollection<int> tagIds, IQuizMasterAction action)
    {
        var changed = _questions.Count(question => question.Untag(tagIds));
        if (changed > 0)
            (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    // A teacher quiz reaches students through an assignment, whose author reviews it: it names no reviewer of its own.
    public AttemptedQuiz ForAttempt()
        => new(null, Id, Name, Settings, ReviewerId: null,
            _questions.OrderBy(question => question.Number).Cast<IQuestionDefinition>().ToList());

    private void Apply(
        string name, string? description, QuizSettings settings, Subject subject, int? stageId, Semester? semester,
        IReadOnlyList<TaggedQuestion> questions)
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
            questions.Select((tagged, i) => new WeightableQuestion(i + 1, tagged.Question.Type, tagged.Question.WeightPercent)).ToList());

        for (var i = 0; i < questions.Count; i++)
        {
            var tags = questions[i].Tags;
            if (!tags.IsEmpty && tags.SubjectId != subject.Id)
                throw new DomainException($"Question {i + 1}: a question can only be tagged with the quiz subject's tags.");
            if (tags.TagIds.Count > Question.MaxTags)
                throw new DomainException($"Question {i + 1}: a question cannot have more than {Question.MaxTags} tags.");
        }

        Name = trimmedName;
        Description = description?.Trim() ?? string.Empty;
        Settings = settings;
        (SubjectId, StageId, Semester) = (subject.Id, stageId, semester);

        _questions.Clear();
        _questions.AddRange(questions.Select((tagged, i) => TeacherQuizQuestion.Create(tagged.Question, tagged.Tags, i + 1)));
    }
}
