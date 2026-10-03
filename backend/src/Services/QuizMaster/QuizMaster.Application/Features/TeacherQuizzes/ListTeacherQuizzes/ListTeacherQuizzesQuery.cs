namespace QuizMaster.Application.Features.TeacherQuizzes.ListTeacherQuizzes;

// Staff only: enumerating teacher quizzes would otherwise hand every teacher's bank to anyone.
// Search matches the name, the description or the author's name.
public record ListTeacherQuizzesQuery(bool Mine = false, int? SubjectId = null, int? StageId = null, string? Search = null) : IQuery<ListTeacherQuizzesResponse>;
public record ListTeacherQuizzesResponse(IReadOnlyList<TeacherQuizSummaryDto> Quizzes);

public class ListTeacherQuizzesQueryValidator : AbstractValidator<ListTeacherQuizzesQuery>
{
    public ListTeacherQuizzesQueryValidator()
        => RuleFor(q => q.Search).MaximumLengthWithMessage(MaxLength.C128, nameof(ListTeacherQuizzesQuery.Search));
}
