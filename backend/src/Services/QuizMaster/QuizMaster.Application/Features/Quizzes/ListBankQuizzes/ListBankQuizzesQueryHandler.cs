namespace QuizMaster.Application.Features.Quizzes.ListBankQuizzes;

public class ListBankQuizzesQueryHandler(QuizMasterDbContext _dbContext, IClaimsProvider _claimsProvider)
    : IRequestHandler<ListBankQuizzesQuery, ListBankQuizzesResponse>
{
    public async Task<ListBankQuizzesResponse> Handle(ListBankQuizzesQuery query, CancellationToken ct)
    {
        var caller = Caller.From(_claimsProvider);
        var quizzes = _dbContext.BankQuizzes.AsNoTracking();

        if (!caller.IsStaff)
        {
            var callerStageId = await _dbContext.Users.Where(user => user.Id == caller.UserId).Select(user => user.StageId).SingleAsync(ct);
            quizzes = quizzes.Where(quiz => quiz.StageId == null || quiz.StageId == callerStageId);
        }

        if (query.SubjectId is { } subjectId)
            quizzes = quizzes.Where(quiz => quiz.SubjectId == subjectId);
        if (query.StageId is { } stageId)
            quizzes = quizzes.Where(quiz => quiz.StageId == stageId);
        if (!string.IsNullOrWhiteSpace(query.Search))
            quizzes = quizzes.Where(quiz => EF.Functions.Like(quiz.Name, $"%{query.Search.Trim()}%"));

        var summaries = await quizzes
            .OrderBy(quiz => quiz.Name)
            .Select(quiz => new BankQuizSummaryDto(
                quiz.Id, quiz.Name, quiz.Description, quiz.Settings, quiz.SubjectId, quiz.StageId, quiz.GradeId, quiz.ClassId,
                quiz.Semester, quiz.ReviewerId, quiz.Questions.Count,
                _dbContext.Participations.Any(participation => participation.BankQuizId == quiz.Id && participation.ChildId == caller.UserId)))
            .ToListAsync(ct);

        return new ListBankQuizzesResponse(summaries);
    }
}
