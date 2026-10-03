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
        if (query.ForSemester is { } forSemester)
            questions = questions.Where(question => question.Semester == null || question.Semester == forSemester);
        if (query.TagId is { } tagId)
            questions = questions.Where(question => question.TagIds.Contains(tagId));
        if (query.Ids is { Length: > 0 } ids)
            questions = questions.Where(question => ids.Contains(question.Id));
        if (TextSearch.ContainsPattern(query.Search) is { } pattern)
        {
            var searchedId = int.TryParse(query.Search!.Trim(), out var number) ? number : 0;
            questions = questions.Where(question => EF.Functions.Like(question.Name, pattern, TextSearch.EscapeCharacter) || question.Id == searchedId);
        }

        return await questions
            .OrderByDescending(question => question.Id)
            .ToPageAsync(query, question => question.Adapt<QuestionDto>(), ct);
    }
}
