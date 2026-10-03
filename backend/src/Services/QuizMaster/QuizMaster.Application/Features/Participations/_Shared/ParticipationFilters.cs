using QuizMaster.Application.Features.Assignments.Shared;

namespace QuizMaster.Application.Features.Participations.Shared;

// Whether a teacher has given a submission their verdict yet: the Validation tab's Pending / Reviewed.
public enum ReviewVerdict
{
    Pending = 1,
    Reviewed = 2,
}

// The review queue's filters: the same filter bar as the assignments (AssignmentFilter), applied to submissions —
// including those to a bank quiz, which have no assignment and so take their subject and semester from the quiz.
public static class ParticipationFilters
{
    public static IQueryable<Participation> Matching(this IQueryable<Participation> participations, AssignmentFilter filter, QuizMasterDbContext dbContext)
    {
        if (filter.SubjectId is { } subjectId)
            participations = participations.Where(participation => (
                dbContext.Assignments.Where(assignment => assignment.Id == participation.HomeworkId).Select(assignment => assignment.SubjectId).FirstOrDefault()
                ?? dbContext.TeacherQuizzes.Where(quiz => quiz.Id == participation.TeacherQuizId).Select(quiz => (int?)quiz.SubjectId).FirstOrDefault()
                ?? dbContext.BankQuizzes.Where(quiz => quiz.Id == participation.BankQuizId).Select(quiz => quiz.SubjectId).FirstOrDefault()) == subjectId);
        if (filter.Semester is { } semester)
            participations = participations.Where(participation => (
                dbContext.Assignments.Where(assignment => assignment.Id == participation.HomeworkId).Select(assignment => assignment.Semester).FirstOrDefault()
                ?? dbContext.TeacherQuizzes.Where(quiz => quiz.Id == participation.TeacherQuizId).Select(quiz => quiz.Semester).FirstOrDefault()
                ?? dbContext.BankQuizzes.Where(quiz => quiz.Id == participation.BankQuizId).Select(quiz => quiz.Semester).FirstOrDefault()) == semester);
        if (filter.ClassId is { } classId)
            participations = participations.Where(participation => participation.ClassId == classId);
        // the kind the student sees: an assignment says what it is; a submission with no assignment is a quiz
        if (filter.Kind is AssignmentKind.Quiz)
            participations = participations.Where(participation => participation.HomeworkId == null
                || dbContext.Assignments.Any(assignment => assignment.Id == participation.HomeworkId && assignment.Kind == AssignmentKind.Quiz));
        if (filter.Kind is AssignmentKind.Homework)
            participations = participations.Where(participation => participation.HomeworkId != null
                && dbContext.Assignments.Any(assignment => assignment.Id == participation.HomeworkId && assignment.Kind == AssignmentKind.Homework));
        if (TextSearch.ContainsPattern(filter.Search) is { } pattern)
            participations = participations.Where(participation => EF.Functions.Like(participation.QuizName, pattern, TextSearch.EscapeCharacter)
                || EF.Functions.Like(participation.HomeworkTitle!, pattern, TextSearch.EscapeCharacter));
        return participations;
    }

    public static IQueryable<Participation> WithVerdict(this IQueryable<Participation> participations, ReviewVerdict verdict)
        => verdict == ReviewVerdict.Reviewed
            ? participations.Where(participation => participation.ValidationStatus != null)
            : participations.Where(participation => participation.ValidationStatus == null);
}
