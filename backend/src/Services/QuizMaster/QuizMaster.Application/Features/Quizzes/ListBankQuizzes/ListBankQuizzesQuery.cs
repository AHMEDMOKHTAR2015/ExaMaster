namespace QuizMaster.Application.Features.Quizzes.ListBankQuizzes;

// The bank as a list. A student sees open quizzes and those of their own stage (the app's filterQuizzesForChildStage).
public record ListBankQuizzesQuery(int? SubjectId = null, int? StageId = null, string? Search = null) : IQuery<ListBankQuizzesResponse>;
public record ListBankQuizzesResponse(IReadOnlyList<BankQuizSummaryDto> Quizzes);

public class ListBankQuizzesQueryValidator : AbstractValidator<ListBankQuizzesQuery>
{
    public ListBankQuizzesQueryValidator()
        => RuleFor(q => q.Search).MaximumLengthWithMessage(MaxLength.C128, nameof(ListBankQuizzesQuery.Search));
}
