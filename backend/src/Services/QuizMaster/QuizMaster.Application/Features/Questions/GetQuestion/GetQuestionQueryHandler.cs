namespace QuizMaster.Application.Features.Questions.GetQuestion;

public class GetQuestionQueryHandler(Repository<Question> _questionRepository)
    : IRequestHandler<GetQuestionQuery, GetQuestionResponse>
{
    public async Task<GetQuestionResponse> Handle(GetQuestionQuery query, CancellationToken ct)
    {
        var question = Guard.NotFound(await _questionRepository.GetByIdAsync(query.Id, ct));

        return new GetQuestionResponse(question.Adapt<QuestionDto>());
    }
}
