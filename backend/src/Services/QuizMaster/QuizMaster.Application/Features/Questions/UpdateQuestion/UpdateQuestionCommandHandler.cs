using QuizMaster.Application.Features.Questions.Shared;

namespace QuizMaster.Application.Features.Questions.UpdateQuestion;

public class UpdateQuestionCommandHandler(
    Repository<Question> _questionRepository, SubjectRepository _subjectRepository, Repository<Stage> _stageRepository, Repository<Grade> _gradeRepository)
    : IRequestHandler<UpdateQuestionCommand, IdResponse>
{
    public async Task<IdResponse> Handle(UpdateQuestionCommand command, CancellationToken ct)
    {
        var question = await _questionRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        var tagIds = command.TagIds ?? (command.SubjectId == question.SubjectId ? question.TagIds : []);
        var tags = await _subjectRepository.LoadTagsAsync(command.SubjectId, tagIds, ct);
        await _stageRepository.EnsureExistsAsync(command.StageId, ct);
        await _gradeRepository.EnsureExistsAsync(command.GradeId, ct);

        question.Update(
            AuthoredQuestion.From(command.ToDraft()),
            new QuestionClassification(command.SubjectId, command.StageId, command.GradeId, command.Semester),
            tags,
            command);

        await _questionRepository.SaveChangesAsync(ct);

        return new IdResponse(question.Id);
    }
}
