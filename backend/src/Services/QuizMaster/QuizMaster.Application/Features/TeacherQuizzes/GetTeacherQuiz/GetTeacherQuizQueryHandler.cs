namespace QuizMaster.Application.Features.TeacherQuizzes.GetTeacherQuiz;

public class GetTeacherQuizQueryHandler(TeacherQuizRepository _teacherQuizRepository)
    : IRequestHandler<GetTeacherQuizQuery, GetTeacherQuizResponse>
{
    public async Task<GetTeacherQuizResponse> Handle(GetTeacherQuizQuery query, CancellationToken ct)
    {
        var quiz = Guard.NotFound(await _teacherQuizRepository.GetByIdAsync(query.Id, ct));

        return new GetTeacherQuizResponse(quiz.Adapt<TeacherQuizDto>());
    }
}
