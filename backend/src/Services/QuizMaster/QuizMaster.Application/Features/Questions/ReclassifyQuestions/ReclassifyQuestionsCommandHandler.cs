namespace QuizMaster.Application.Features.Questions.ReclassifyQuestions;

public class ReclassifyQuestionsCommandHandler(
    Repository<Question> _questionRepository, Repository<Subject> _subjectRepository, Repository<Stage> _stageRepository, Repository<Grade> _gradeRepository)
    : IRequestHandler<ReclassifyQuestionsCommand, ReclassifyQuestionsResponse>
{
    public async Task<ReclassifyQuestionsResponse> Handle(ReclassifyQuestionsCommand command, CancellationToken ct)
    {
        await _subjectRepository.EnsureExistsAsync(command.SubjectId, ct);
        await _stageRepository.EnsureExistsAsync(command.StageId, ct);
        await _gradeRepository.EnsureExistsAsync(command.GradeId, ct);

        var questions = await _questionRepository.GetByIdsAsync(command.QuestionIds, ct);
        foreach (var question in questions)
            question.Reclassify(new QuestionClassification(
                command.SubjectId ?? question.SubjectId,
                command.StageId ?? question.StageId,
                command.GradeId ?? question.GradeId,
                command.Semester ?? question.Semester), command);

        await _questionRepository.SaveChangesAsync(ct);
        return new ReclassifyQuestionsResponse(questions.Count);
    }
}
