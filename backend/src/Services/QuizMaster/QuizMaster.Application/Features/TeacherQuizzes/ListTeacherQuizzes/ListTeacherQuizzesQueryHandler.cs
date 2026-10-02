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

        // the question count is computed by the database: a list never loads the questions themselves
        var rows = await quizzes.OrderByDescending(quiz => quiz.CreatedOn)
            .Select(quiz => new { Quiz = quiz, QuestionCount = quiz.Questions.Count })
            .ToListAsync(ct);

        return new ListTeacherQuizzesResponse(rows
            .Select(row => row.Quiz.Adapt<TeacherQuizSummaryDto>() with { QuestionCount = row.QuestionCount })
            .ToList());
    }
}
