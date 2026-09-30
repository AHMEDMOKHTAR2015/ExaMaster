namespace QuizMaster.Application.Features.Questions.CreateQuestions;

public class CreateQuestionsCommandHandler(
    Repository<Question> _questionRepository, Repository<Subject> _subjectRepository, Repository<Stage> _stageRepository, Repository<Grade> _gradeRepository)
    : IRequestHandler<CreateQuestionsCommand, CreateQuestionsResponse>
{
    public async Task<CreateQuestionsResponse> Handle(CreateQuestionsCommand command, CancellationToken ct)
    {
        foreach (var id in command.Questions.Select(q => q.SubjectId).Distinct()) await _subjectRepository.EnsureExistsAsync(id, ct);
        foreach (var id in command.Questions.Select(q => q.StageId).Distinct()) await _stageRepository.EnsureExistsAsync(id, ct);
        foreach (var id in command.Questions.Select(q => q.GradeId).Distinct()) await _gradeRepository.EnsureExistsAsync(id, ct);

        // every question is authored (and so validated) before any is saved
        var authored = AuthoredQuestion.FromAll(command.Questions.Select(q => q.ToDraft()).ToList());
        var questions = authored.Select((question, i) =>
        {
            var input = command.Questions[i];
            return Question.Create(question, new QuestionClassification(input.SubjectId, input.StageId, input.GradeId, input.Semester), command);
        }).ToList();

        await _questionRepository.AddRangeAsync(questions, ct);
        await _questionRepository.SaveChangesAsync(ct);            // one commit: all of them or none

        return new CreateQuestionsResponse(questions.Select(question => question.Id).ToList());
    }
}
