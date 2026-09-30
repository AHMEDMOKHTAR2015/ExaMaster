namespace QuizMaster.Application.Features.Quizzes.GetBankQuizSitting;

// A bank quiz ready to sit on its own (practice): questions in order, WITHOUT answers.
public record GetBankQuizSittingQuery(int Id) : IQuery<SittingDto>;

public class GetBankQuizSittingQueryValidator : AbstractValidator<GetBankQuizSittingQuery>
{
    public GetBankQuizSittingQueryValidator()
        => RuleFor(q => q.Id).GreaterThan(0).WithMessageForInvalidId(nameof(GetBankQuizSittingQuery.Id));
}
