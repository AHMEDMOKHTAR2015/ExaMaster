namespace QuizMaster.Application.Features.Quizzes.GetBankQuiz;

public class GetBankQuizQueryHandler(BankQuizRepository _bankQuizRepository)
    : IRequestHandler<GetBankQuizQuery, GetBankQuizResponse>
{
    public async Task<GetBankQuizResponse> Handle(GetBankQuizQuery query, CancellationToken ct)
    {
        var quiz = Guard.NotFound(await _bankQuizRepository.GetByIdAsync(query.Id, ct));

        return new GetBankQuizResponse(quiz.Adapt<BankQuizDto>());
    }
}
