using QuizMaster.Application.Features.Questions.Shared;

namespace QuizMaster.Application.Features.Questions.TagQuestion;

public class TagQuestionCommandHandler(Repository<Question> _questionRepository, SubjectRepository _subjectRepository)
    : IRequestHandler<TagQuestionCommand, IdResponse>
{
    public async Task<IdResponse> Handle(TagQuestionCommand command, CancellationToken ct)
    {
        var question = await _questionRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        var tags = await _subjectRepository.LoadTagsAsync(question.SubjectId, command.TagIds, ct);

        question.Tag(tags, command);

        await _questionRepository.SaveChangesAsync(ct);

        return new IdResponse(question.Id);
    }
}
