namespace QuizMaster.Domain.Quizzes;

public partial class BankQuiz
{
    public const int MaxNameLength = MaxLength.C256;
    public const int MaxDescriptionLength = MaxLength.C2048;
    public const int MaxQuestions = 200;

    public static BankQuiz Create(
        string name, string? description, QuizSettings settings, QuizPlacement placement, User reviewer,
        IReadOnlyList<Question> questions, IQuizMasterAction action)
    {
        var quiz = new BankQuiz { CreatedById = action.CreatedById, CreatedOn = action.CreatedOn };
        quiz.Apply(name, description, settings, placement, reviewer, questions);
        return quiz;
    }

    public void Update(
        string name, string? description, QuizSettings settings, QuizPlacement placement, User reviewer,
        IReadOnlyList<Question> questions, IQuizMasterAction action)
    {
        Apply(name, description, settings, placement, reviewer, questions);
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    // The stored question list is the authority on what belongs to this quiz, never the ids a client sends.
    // A bank question deleted since the quiz was saved is skipped, exactly as the app's submitQuiz did.
    public AttemptedQuiz ForAttempt(IReadOnlyCollection<Question> bankQuestions)
    {
        var byId = bankQuestions.ToDictionary(question => question.Id);
        var inOrder = _questions
            .OrderBy(entry => entry.Position)
            .Where(entry => byId.ContainsKey(entry.QuestionId))
            .Select(entry => (IQuestionDefinition)byId[entry.QuestionId])
            .ToList();

        return new AttemptedQuiz(Id, null, Name, Settings, ReviewerId, inOrder);
    }

    public IReadOnlyList<int> QuestionIdsInOrder => _questions.OrderBy(entry => entry.Position).Select(entry => entry.QuestionId).ToList();

    private void Apply(
        string name, string? description, QuizSettings settings, QuizPlacement placement, User reviewer, IReadOnlyList<Question> questions)
    {
        //insight - without a reviewer, every Explain or Complete answer in the quiz would be gradable by nobody
        if (!reviewer.IsTeacher || !reviewer.IsActive)
            throw new DomainException("A bank quiz's reviewer must be an active teacher.");
        if (questions.Count == 0)
            throw new DomainException("A quiz needs at least one question.");

        ApplyContent(name, description, settings, placement, reviewer.Id, questions);
    }

    // The rules every stored quiz obeys.
    private void ApplyContent(
        string name, string? description, QuizSettings settings, QuizPlacement placement, int? reviewerId, IReadOnlyList<Question> questions)
    {
        var trimmedName = name?.Trim();
        if (string.IsNullOrEmpty(trimmedName) || trimmedName.Length > MaxNameLength)
            throw new DomainException($"A quiz needs a name of at most {MaxNameLength} characters.");
        if (description?.Length > MaxDescriptionLength)
            throw new DomainException($"A quiz description cannot exceed {MaxDescriptionLength} characters.");

        settings.EnsureValid();

        if (questions.Count > MaxQuestions)
            throw new DomainException($"A quiz cannot have more than {MaxQuestions} questions.");
        if (questions.Select(question => question.Id).Distinct().Count() != questions.Count)
            throw new DomainException("A question can appear only once in a quiz.");

        QuizScoring.EnsureValidExplainWeights(questions.Select(QuizGrader.ToWeightable).ToList());

        Name = trimmedName;
        Description = description?.Trim() ?? string.Empty;
        Settings = settings;
        (SubjectId, StageId, GradeId, ClassId, Semester) = (placement.SubjectId, placement.StageId, placement.GradeId, placement.ClassId, placement.Semester);
        ReviewerId = reviewerId;

        _questions.Clear();
        _questions.AddRange(questions.Select((question, position) => BankQuizQuestion.Create(question.Id, position)));
    }
}
