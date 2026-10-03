namespace QuizMaster.Application.Features.Questions.SearchQuestions;

// Browsing the bank, with answers: an administrator's action (listing answers is admin-only).
public record SearchQuestionsQuery(
    QuestionType? Type = null,
    int? SubjectId = null,
    int? StageId = null,
    int? GradeId = null,
    Semester? Semester = null,
    Semester? ForSemester = null,          // that semester OR none (the quiz builder's picker: an unclassified question fits any term)
    int? TagId = null,
    string? Search = null,                 // the question's text; an all-digits search also matches that question id
    int[]? Ids = null,                     // exactly these questions (a quiz's own, for its builder), at most a page of them
    int Page = 1,
    int PageSize = Paging.DefaultPageSize) : IQuery<PagedResponse<QuestionDto>>, IPagedQuery;

public class SearchQuestionsQueryValidator : AbstractValidator<SearchQuestionsQuery>
{
    public SearchQuestionsQueryValidator()
    {
        this.AddPagingRules();
        RuleFor(q => q.Search).MaximumLengthWithMessage(MaxLength.C128, nameof(SearchQuestionsQuery.Search));
        RuleFor(q => q.Semester).IsInEnum();
        RuleFor(q => q.ForSemester).IsInEnum();
        RuleFor(q => q.Ids).Must(ids => ids is null || ids.Length <= Paging.MaxPageSize)
            .WithMessage($"Ask for at most {Paging.MaxPageSize} questions by id at a time.");
    }
}
