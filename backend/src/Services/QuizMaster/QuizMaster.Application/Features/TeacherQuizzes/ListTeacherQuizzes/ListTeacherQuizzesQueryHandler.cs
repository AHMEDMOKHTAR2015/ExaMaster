namespace QuizMaster.Application.Features.TeacherQuizzes.ListTeacherQuizzes;

public class ListTeacherQuizzesQueryHandler(TeacherQuizRepository _teacherQuizRepository, IClaimsProvider _claimsProvider, QuizMasterDbContext _dbContext)
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
        if (TextSearch.ContainsPattern(query.Search) is { } pattern)
            quizzes = quizzes.Where(quiz => EF.Functions.Like(quiz.Name, pattern, TextSearch.EscapeCharacter)
                || EF.Functions.Like(quiz.Description!, pattern, TextSearch.EscapeCharacter)
                || _dbContext.Users.Any(author => author.Id == quiz.CreatedById && EF.Functions.Like(author.DisplayName, pattern, TextSearch.EscapeCharacter)));

        // the question count is computed by the database: a list never loads the questions themselves
        var rows = await quizzes.OrderByDescending(quiz => quiz.CreatedOn)
            .Select(quiz => new { Quiz = quiz, QuestionCount = quiz.Questions.Count })
            .ToListAsync(ct);

        return new ListTeacherQuizzesResponse(rows
            .Select(row => row.Quiz.Adapt<TeacherQuizSummaryDto>() with { QuestionCount = row.QuestionCount })
            .ToList());
    }
}
