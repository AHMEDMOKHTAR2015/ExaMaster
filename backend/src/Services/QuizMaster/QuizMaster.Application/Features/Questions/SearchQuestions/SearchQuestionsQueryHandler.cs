namespace QuizMaster.Application.Features.Questions.SearchQuestions;

public class SearchQuestionsQueryHandler(Repository<Question> _questionRepository)
    : IRequestHandler<SearchQuestionsQuery, PagedResponse<QuestionDto>>
{
    public async Task<PagedResponse<QuestionDto>> Handle(SearchQuestionsQuery query, CancellationToken ct)
    {
        var questions = _questionRepository.QueryNotTracked();

        if (query.Type is { } type)
            questions = questions.Where(question => question.Type == type);
        if (query.SubjectId is { } subjectId)
            questions = questions.Where(question => question.SubjectId == subjectId);
        if (query.StageId is { } stageId)
            questions = questions.Where(question => question.StageId == stageId);
        if (query.GradeId is { } gradeId)
            questions = questions.Where(question => question.GradeId == gradeId);
        if (query.Semester is { } semester)
            questions = questions.Where(question => question.Semester == semester);
        if (!string.IsNullOrWhiteSpace(query.Search))
            questions = questions.Where(question => EF.Functions.Like(question.Name, $"%{query.Search.Trim()}%"));

        return await questions
            .OrderByDescending(question => question.Id)
            .ToPageAsync(query, question => question.Adapt<QuestionDto>(), ct);
    }
}
