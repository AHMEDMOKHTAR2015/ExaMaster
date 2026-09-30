namespace QuizMaster.Application.Features.Quizzes.GetBankQuiz;

// The quiz as its author edits it: settings, placement, reviewer and the ordered question ids.
public record GetBankQuizQuery(int Id) : IQuery<GetBankQuizResponse>;
public record GetBankQuizResponse(BankQuizDto Quiz);

public class GetBankQuizQueryValidator : AbstractValidator<GetBankQuizQuery>
{
    public GetBankQuizQueryValidator()
        => RuleFor(q => q.Id).GreaterThan(0).WithMessageForInvalidId(nameof(GetBankQuizQuery.Id));
}
