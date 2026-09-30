using QuizMaster.Application.Features.Attempts.Shared;

namespace QuizMaster.Application.Features.TeacherQuizzes.GetTeacherQuizSitting;

public class GetTeacherQuizSittingQueryHandler(AttemptedQuizLoader _quizLoader)
    : IRequestHandler<GetTeacherQuizSittingQuery, SittingDto>
{
    public async Task<SittingDto> Handle(GetTeacherQuizSittingQuery query, CancellationToken ct)
    {
        var quiz = await _quizLoader.LoadTeacherQuizAsync(query.Id, ct);

        return SittingDto.From(quiz, homework: null);
    }
}
