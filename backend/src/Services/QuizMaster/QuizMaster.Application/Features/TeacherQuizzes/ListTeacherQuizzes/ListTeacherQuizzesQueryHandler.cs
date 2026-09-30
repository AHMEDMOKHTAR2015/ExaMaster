namespace QuizMaster.Application.Features.TeacherQuizzes.ListTeacherQuizzes;

public class ListTeacherQuizzesQueryHandler(TeacherQuizRepository _teacherQuizRepository, IClaimsProvider _claimsProvider)
    : IRequestHandler<ListTeacherQuizzesQuery, ListTeacherQuizzesResponse>
{
    public async Task<ListTeacherQuizzesResponse> Handle(ListTeacherQuizzesQuery query, CancellationToken ct)
    {
        var quizzes = _teacherQuizRepository.QueryNotTracked();

        if (query.Mine)
        {
            var userId = _claimsProvider.GetUserId();
            quizzes = quizzes.Where(quiz => quiz.CreatedById == userId);
        }
        if (query.SubjectId is { } subjectId)
            quizzes = quizzes.Where(quiz => quiz.SubjectId == subjectId);
        if (query.StageId is { } stageId)
            quizzes = quizzes.Where(quiz => quiz.StageId == stageId);

        var list = await quizzes.OrderByDescending(quiz => quiz.CreatedOn).ToListAsync(ct);

        return new ListTeacherQuizzesResponse(list.Adapt<List<TeacherQuizSummaryDto>>());
    }
}
