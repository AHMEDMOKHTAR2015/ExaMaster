namespace QuizMaster.Application.Features.Questions.SearchQuestions;

// Browsing the bank, with answers: an administrator's action (listing answers is admin-only).
public record SearchQuestionsQuery(
    QuestionType? Type = null,
    int? SubjectId = null,
    int? StageId = null,
    int? GradeId = null,
    Semester? Semester = null,
    string? Search = null,
    int Page = 1,
    int PageSize = Paging.DefaultPageSize) : IQuery<PagedResponse<QuestionDto>>, IPagedQuery;

public class SearchQuestionsQueryValidator : AbstractValidator<SearchQuestionsQuery>
{
    public SearchQuestionsQueryValidator()
    {
        this.AddPagingRules();
        RuleFor(q => q.Search).MaximumLengthWithMessage(MaxLength.C128, nameof(SearchQuestionsQuery.Search));
    }
}
