namespace QuizMaster.Application.Features.TeacherQuizzes.GetTeacherQuizSitting;

// A teacher quiz ready to sit: questions in order, WITHOUT answers.
public record GetTeacherQuizSittingQuery(int Id) : IQuery<SittingDto>;

public class GetTeacherQuizSittingQueryValidator : AbstractValidator<GetTeacherQuizSittingQuery>
{
    public GetTeacherQuizSittingQueryValidator()
        => RuleFor(q => q.Id).GreaterThan(0).WithMessageForInvalidId(nameof(GetTeacherQuizSittingQuery.Id));
}
