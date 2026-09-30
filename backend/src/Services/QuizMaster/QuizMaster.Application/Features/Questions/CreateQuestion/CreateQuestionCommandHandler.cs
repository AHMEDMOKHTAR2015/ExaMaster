namespace QuizMaster.Application.Features.Questions.CreateQuestion;

public class CreateQuestionCommandHandler(
    Repository<Question> _questionRepository, Repository<Subject> _subjectRepository, Repository<Stage> _stageRepository, Repository<Grade> _gradeRepository)
    : IRequestHandler<CreateQuestionCommand, IdResponse>
{
    public async Task<IdResponse> Handle(CreateQuestionCommand command, CancellationToken ct)
    {
        await _subjectRepository.EnsureExistsAsync(command.SubjectId, ct);
        await _stageRepository.EnsureExistsAsync(command.StageId, ct);
        await _gradeRepository.EnsureExistsAsync(command.GradeId, ct);

        var question = Question.Create(
            AuthoredQuestion.From(command.ToDraft()),
            new QuestionClassification(command.SubjectId, command.StageId, command.GradeId, command.Semester),
            command);

        await _questionRepository.AddAsync(question, ct);
        await _questionRepository.SaveChangesAsync(ct);

        return new IdResponse(question.Id);
    }
}
