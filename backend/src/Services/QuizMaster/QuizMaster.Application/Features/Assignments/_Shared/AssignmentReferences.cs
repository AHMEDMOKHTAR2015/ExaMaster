namespace QuizMaster.Application.Features.Assignments.Shared;

// Loads what an assignment command refers to: the quiz it sets, the class it targets, the students it names.
public class AssignmentReferences(
    BankQuizRepository _bankQuizRepository,
    TeacherQuizRepository _teacherQuizRepository,
    Repository<ClassGroup> _classRepository,
    Repository<Subject> _subjectRepository,
    Repository<User> _userRepository)
{
    public async Task<(QuizReference Quiz, ClassGroup TargetClass, IReadOnlyCollection<User> Children)> LoadAsync(
        IAssignmentInput input, CancellationToken ct)
    {
        var quiz = input.Source switch
        {
            QuizSource.Bank => QuizReference.To(await _bankQuizRepository.LoadOrThrowAsync(input.QuizId, ct)),
            QuizSource.Custom => QuizReference.To(await _teacherQuizRepository.LoadOrThrowAsync(input.QuizId, ct)),
            _ => throw new BadRequestException("Unknown quiz source.")
        };

        var targetClass = await _classRepository.LoadOrThrowAsync(input.ClassId, ct);
        await _subjectRepository.EnsureExistsAsync(input.SubjectId, ct);
        var children = await _userRepository.LoadAllOrThrowAsync(input.AssignedChildIds, ct);

        return (quiz, targetClass, children);
    }
}

public interface IAssignmentInput
{
    string Title { get; }
    AssignmentKind Kind { get; }
    QuizSource Source { get; }
    int QuizId { get; }
    int ClassId { get; }
    int? SubjectId { get; }
    Semester? Semester { get; }
    DateTimeOffset DueAt { get; }
    List<int>? AssignedChildIds { get; }
}

public static class AssignmentValidation
{
    public static void AddAssignmentRules<T>(this AbstractValidator<T> validator)
        where T : IAssignmentInput
    {
        validator.RuleFor(c => c.Title).NotEmptyWithMessage(nameof(IAssignmentInput.Title))
            .MaximumLengthWithMessage(HomeworkAssignment.MaxTitleLength, nameof(IAssignmentInput.Title));
        validator.RuleFor(c => c.Kind).IsInEnum();
        validator.RuleFor(c => c.Source).IsInEnum();
        validator.RuleFor(c => c.QuizId).GreaterThan(0).WithMessageForInvalidId(nameof(IAssignmentInput.QuizId));
        validator.RuleFor(c => c.ClassId).GreaterThan(0).WithMessageForInvalidId(nameof(IAssignmentInput.ClassId));
    }
}
