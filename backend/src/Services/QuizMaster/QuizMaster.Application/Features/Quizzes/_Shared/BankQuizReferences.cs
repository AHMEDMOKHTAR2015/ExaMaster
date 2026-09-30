namespace QuizMaster.Application.Features.Quizzes.Shared;

// Loads what a bank quiz command refers to, with the questions in the order the author gave them.
public class BankQuizReferences(
    Repository<User> _userRepository,
    Repository<Question> _questionRepository,
    Repository<Subject> _subjectRepository,
    Repository<Stage> _stageRepository,
    Repository<Grade> _gradeRepository,
    Repository<ClassGroup> _classRepository)
{
    public async Task<(User Reviewer, IReadOnlyList<Question> Questions)> LoadAsync(
        int reviewerId, IReadOnlyList<int> questionIds, QuizPlacement placement, CancellationToken ct)
    {
        await _subjectRepository.EnsureExistsAsync(placement.SubjectId, ct);
        await _stageRepository.EnsureExistsAsync(placement.StageId, ct);
        await _gradeRepository.EnsureExistsAsync(placement.GradeId, ct);
        await _classRepository.EnsureExistsAsync(placement.ClassId, ct);

        var reviewer = await _userRepository.LoadOrThrowAsync(reviewerId, ct);

        var byId = (await _questionRepository.LoadAllOrThrowAsync(questionIds, ct)).ToDictionary(question => question.Id);
        var inRequestedOrder = questionIds.Select(id => byId[id]).ToList();   // duplicates kept: the quiz itself rejects them

        return (reviewer, inRequestedOrder);
    }
}
