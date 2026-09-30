namespace QuizMaster.Application.Features.TeacherQuizzes.GetTeacherQuiz;

// A teacher quiz WITH its answers, for staff (the author editing it, a colleague copying from it).
public record GetTeacherQuizQuery(int Id) : IQuery<GetTeacherQuizResponse>;
public record GetTeacherQuizResponse(TeacherQuizDto Quiz);

public class GetTeacherQuizQueryValidator : AbstractValidator<GetTeacherQuizQuery>
{
    public GetTeacherQuizQueryValidator()
        => RuleFor(q => q.Id).GreaterThan(0).WithMessageForInvalidId(nameof(GetTeacherQuizQuery.Id));
}
