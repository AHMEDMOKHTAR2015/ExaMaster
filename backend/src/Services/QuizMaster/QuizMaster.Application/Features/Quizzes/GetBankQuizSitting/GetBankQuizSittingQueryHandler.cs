using QuizMaster.Application.Features.Attempts.Shared;

namespace QuizMaster.Application.Features.Quizzes.GetBankQuizSitting;

public class GetBankQuizSittingQueryHandler(AttemptedQuizLoader _quizLoader)
    : IRequestHandler<GetBankQuizSittingQuery, SittingDto>
{
    public async Task<SittingDto> Handle(GetBankQuizSittingQuery query, CancellationToken ct)
    {
        var quiz = await _quizLoader.LoadBankQuizAsync(query.Id, ct);

        return SittingDto.From(quiz, homework: null);
    }
}
