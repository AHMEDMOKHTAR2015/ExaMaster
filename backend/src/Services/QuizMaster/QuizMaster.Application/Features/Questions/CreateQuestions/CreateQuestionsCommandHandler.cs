using QuizMaster.Application.Features.Questions.Shared;

namespace QuizMaster.Application.Features.Questions.CreateQuestions;

public class CreateQuestionsCommandHandler(
    Repository<Question> _questionRepository, SubjectRepository _subjectRepository, Repository<Stage> _stageRepository, Repository<Grade> _gradeRepository)
    : IRequestHandler<CreateQuestionsCommand, CreateQuestionsResponse>
{
    public async Task<CreateQuestionsResponse> Handle(CreateQuestionsCommand command, CancellationToken ct)
    {
        var subjects = (await _subjectRepository.LoadAllOrThrowAsync(command.Questions.Select(q => q.SubjectId).OfType<int>().ToList(), ct))
            .ToDictionary(subject => subject.Id);
        foreach (var id in command.Questions.Select(q => q.StageId).Distinct()) await _stageRepository.EnsureExistsAsync(id, ct);
        foreach (var id in command.Questions.Select(q => q.GradeId).Distinct()) await _gradeRepository.EnsureExistsAsync(id, ct);

        // every question is authored (and so validated) before any is saved
        var authored = AuthoredQuestion.FromAll(command.Questions.Select(q => q.ToDraft()).ToList());
        var questions = authored.Select((question, i) =>
        {
            var input = command.Questions[i];
            try
            {
                var tags = QuestionTagging.TagsFor(input.SubjectId is { } subjectId ? subjects[subjectId] : null, input.TagIds);
                return Question.Create(question, new QuestionClassification(input.SubjectId, input.StageId, input.GradeId, input.Semester), tags, command);
            }
            catch (DomainException ex)
            {
                throw new DomainException($"Question {i + 1}: {ex.Message}", ex);
            }
        }).ToList();

        await _questionRepository.AddRangeAsync(questions, ct);
        await _questionRepository.SaveChangesAsync(ct);            // one commit: all of them or none

        return new CreateQuestionsResponse(questions.Select(question => question.Id).ToList());
    }
}
