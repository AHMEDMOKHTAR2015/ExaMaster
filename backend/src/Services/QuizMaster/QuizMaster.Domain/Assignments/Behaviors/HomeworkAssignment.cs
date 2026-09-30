namespace QuizMaster.Domain.Assignments;

public partial class HomeworkAssignment
{
    public const int MaxTitleLength = MaxLength.C256;

    public static HomeworkAssignment Create(
        string title, AssignmentKind kind, QuizReference quiz, ClassGroup targetClass, int? subjectId, Semester? semester,
        DateTime dueAt, IReadOnlyCollection<User> assignedChildren, IQuizMasterAction action)
    {
        if (dueAt <= action.CreatedOn)
            throw new DomainException("An assignment's due date must be in the future.");

        var assignment = new HomeworkAssignment
        {
            IsActive = true,
            CreatedById = action.CreatedById,
            CreatedOn = action.CreatedOn
        };
        assignment.Apply(title, kind, quiz, targetClass, subjectId, semester, dueAt, assignedChildren, requireChildrenInClass: true);
        return assignment;
    }

    public void Update(
        string title, AssignmentKind kind, QuizReference quiz, ClassGroup targetClass, int? subjectId, Semester? semester,
        DateTime dueAt, bool isActive, IReadOnlyCollection<User> assignedChildren, IQuizMasterAction action)
    {
        Apply(title, kind, quiz, targetClass, subjectId, semester, dueAt, assignedChildren, requireChildrenInClass: true);
        IsActive = isActive;
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    public bool IsOwnedBy(int userId) => CreatedById == userId;

    //insight - mirrors the app's submitQuiz entitlement: named students only, when named; otherwise the class,
    // and also the stage (students' assignment lists are loaded by class AND by stage)
    public bool IsAssignedTo(User student)
        => AssignedChildIds.Count > 0
            ? AssignedChildIds.Contains(student.Id)
            : ClassId == student.ClassId || StageId == student.StageId;

    public void EnsureOpenFor(User student)
    {
        if (!IsActive)
            throw new DomainException("That assignment is no longer open.");
        if (!IsAssignedTo(student))
            throw new DomainException("That assignment was not set for you.");
    }

    // Correct answers stay withheld until the assignment is over, so an early "throwaway" submission
    // cannot be used to read the key ahead of a later, real attempt.
    public bool AreResultsAvailableAt(DateTime now) => now >= DueAt;

    private void Apply(
        string title, AssignmentKind kind, QuizReference quiz, ClassGroup targetClass, int? subjectId, Semester? semester,
        DateTime dueAt, IReadOnlyCollection<User> assignedChildren, bool requireChildrenInClass)
    {
        var trimmedTitle = title?.Trim();
        if (string.IsNullOrEmpty(trimmedTitle) || trimmedTitle.Length > MaxTitleLength)
            throw new DomainException($"An assignment needs a title of at most {MaxTitleLength} characters.");
        if (dueAt.Kind != DateTimeKind.Utc)
            throw new DomainException("An assignment's due date must be given in UTC.");

        // Named students must belong to the class being assigned (when it is assigned: a student may move class later).
        if (assignedChildren.Any(child => !child.IsStudent || (requireChildrenInClass && child.ClassId != targetClass.Id)))
            throw new DomainException("Every named student must be a student of the assigned class.");

        Title = trimmedTitle;
        Kind = kind;
        Source = quiz.Source;
        BankQuizId = quiz.Source == QuizSource.Bank ? quiz.QuizId : null;
        TeacherQuizId = quiz.Source == QuizSource.Custom ? quiz.QuizId : null;
        (StageId, GradeId, ClassId) = (targetClass.StageId, targetClass.GradeId, targetClass.Id);
        (SubjectId, Semester) = (subjectId, semester);
        DueAt = dueAt;
        AssignedChildIds = assignedChildren.Select(child => child.Id).Distinct().Order().ToList();
    }
}
