namespace QuizMaster.Application.Features.Questions.DeleteQuestion;

public class DeleteQuestionCommandHandler(Repository<Question> _questionRepository)
    : IRequestHandler<DeleteQuestionCommand, IdResponse>
{
    public async Task<IdResponse> Handle(DeleteQuestionCommand command, CancellationToken ct)
    {
        var question = await _questionRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        _questionRepository.Remove(question);
        await _questionRepository.SaveChangesAsync(ct);

        return new IdResponse(question.Id);
    }
}
