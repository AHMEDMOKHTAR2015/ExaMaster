namespace QuizMaster.Application.Features.Questions.GetQuestion;

// A bank question WITH its answer: for authoring surfaces only (an administrator editing it, a teacher copying it).
public record GetQuestionQuery(int Id) : IQuery<GetQuestionResponse>;
public record GetQuestionResponse(QuestionDto Question);

public class GetQuestionQueryValidator : AbstractValidator<GetQuestionQuery>
{
    public GetQuestionQueryValidator()
        => RuleFor(q => q.Id).GreaterThan(0).WithMessageForInvalidId(nameof(GetQuestionQuery.Id));
}
