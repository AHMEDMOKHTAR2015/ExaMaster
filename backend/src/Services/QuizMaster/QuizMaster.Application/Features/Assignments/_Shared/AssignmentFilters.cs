namespace QuizMaster.Application.Features.Assignments.Shared;

// Quiz Management's filter bar as one value. The assignments list, their results and the review queue all narrow by
// it, so the three can never disagree about what "Math, first semester, group 4A, homework" means.
public sealed record AssignmentFilter(
    int? SubjectId = null,
    Semester? Semester = null,
    int? ClassId = null,
    AssignmentKind? Kind = null,
    string? Search = null);

public static class AssignmentFilters
{
    //insight - an assignment's subject and semester are its own, else its quiz's (the client's effectiveSubjectId /
    // effectiveSemester): a quiz tagged once should not need tagging again on every assignment that uses it
    public static IQueryable<HomeworkAssignment> Matching(this IQueryable<HomeworkAssignment> assignments, AssignmentFilter filter, QuizMasterDbContext dbContext)
    {
        if (filter.SubjectId is { } subjectId)
            assignments = assignments.Where(assignment => (assignment.SubjectId
                ?? dbContext.TeacherQuizzes.Where(quiz => quiz.Id == assignment.TeacherQuizId).Select(quiz => (int?)quiz.SubjectId).FirstOrDefault()
                ?? dbContext.BankQuizzes.Where(quiz => quiz.Id == assignment.BankQuizId).Select(quiz => quiz.SubjectId).FirstOrDefault()) == subjectId);
        if (filter.Semester is { } semester)
            assignments = assignments.Where(assignment => (assignment.Semester
                ?? dbContext.TeacherQuizzes.Where(quiz => quiz.Id == assignment.TeacherQuizId).Select(quiz => quiz.Semester).FirstOrDefault()
                ?? dbContext.BankQuizzes.Where(quiz => quiz.Id == assignment.BankQuizId).Select(quiz => quiz.Semester).FirstOrDefault()) == semester);
        if (filter.ClassId is { } classId)
            assignments = assignments.Where(assignment => assignment.ClassId == classId);
        if (filter.Kind is { } kind)
            assignments = assignments.Where(assignment => assignment.Kind == kind);
        if (TextSearch.ContainsPattern(filter.Search) is { } pattern)
            assignments = assignments.Where(assignment => EF.Functions.Like(assignment.Title, pattern, TextSearch.EscapeCharacter)
                || dbContext.TeacherQuizzes.Any(quiz => quiz.Id == assignment.TeacherQuizId && EF.Functions.Like(quiz.Name, pattern, TextSearch.EscapeCharacter))
                || dbContext.BankQuizzes.Any(quiz => quiz.Id == assignment.BankQuizId && EF.Functions.Like(quiz.Name, pattern, TextSearch.EscapeCharacter)));
        return assignments;
    }

    // The filter bar's own validation, shared by every query that takes it.
    public static void AddAssignmentFilterRules<TQuery>(this AbstractValidator<TQuery> validator, Func<TQuery, AssignmentFilter> filter)
    {
        validator.RuleFor(query => filter(query).Semester).IsInEnum().OverridePropertyName("Semester");
        validator.RuleFor(query => filter(query).Kind).IsInEnum().OverridePropertyName("Kind");
        validator.RuleFor(query => filter(query).Search).MaximumLengthWithMessage(MaxLength.C128, "Search");
    }
}
