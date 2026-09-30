using System.Linq.Expressions;

namespace QuizMaster.Application.Features.Assignments.Shared;

// Assignments as their readers see them: with the quiz's name and shape, the author's name, and (for a student) their latest attempt.
public static class AssignmentProjection
{
    public static IQueryable<AssignmentDto> ToDtos(this IQueryable<HomeworkAssignment> assignments, QuizMasterDbContext dbContext, int? submissionsOfStudentId)
        => assignments.Select(Build(dbContext, submissionsOfStudentId));

    // Which assignments a student receives: the ones naming them, or (naming nobody) their class's and their stage's.
    public static IQueryable<HomeworkAssignment> SetFor(this IQueryable<HomeworkAssignment> assignments, int studentId, int? classId, int? stageId)
        => assignments.Where(assignment => assignment.AssignedChildIds.Count > 0
            ? assignment.AssignedChildIds.Contains(studentId)
            : assignment.ClassId == classId || assignment.StageId == stageId);

    private static Expression<Func<HomeworkAssignment, AssignmentDto>> Build(QuizMasterDbContext dbContext, int? studentId)
        => assignment => new AssignmentDto(
            assignment.Id,
            assignment.Title,
            assignment.Kind,
            assignment.Source,
            assignment.BankQuizId,
            assignment.TeacherQuizId,
            assignment.BankQuizId != null
                ? dbContext.BankQuizzes.Where(quiz => quiz.Id == assignment.BankQuizId).Select(quiz => quiz.Name).FirstOrDefault() ?? string.Empty
                : dbContext.TeacherQuizzes.Where(quiz => quiz.Id == assignment.TeacherQuizId).Select(quiz => quiz.Name).FirstOrDefault() ?? string.Empty,
            assignment.BankQuizId != null
                ? dbContext.BankQuizzes.Where(quiz => quiz.Id == assignment.BankQuizId).Select(quiz => quiz.Questions.Count).FirstOrDefault()
                : dbContext.TeacherQuizzes.Where(quiz => quiz.Id == assignment.TeacherQuizId).Select(quiz => quiz.Questions.Count).FirstOrDefault(),
            assignment.BankQuizId != null
                ? dbContext.BankQuizzes.Where(quiz => quiz.Id == assignment.BankQuizId).Select(quiz => quiz.Settings.DurationSeconds).FirstOrDefault()
                : dbContext.TeacherQuizzes.Where(quiz => quiz.Id == assignment.TeacherQuizId).Select(quiz => quiz.Settings.DurationSeconds).FirstOrDefault(),
            assignment.BankQuizId != null
                ? dbContext.BankQuizzes.Where(quiz => quiz.Id == assignment.BankQuizId).Select(quiz => quiz.Settings.OneTimeJoin).FirstOrDefault()
                : dbContext.TeacherQuizzes.Where(quiz => quiz.Id == assignment.TeacherQuizId).Select(quiz => quiz.Settings.OneTimeJoin).FirstOrDefault(),
            assignment.StageId,
            assignment.GradeId,
            assignment.ClassId,
            assignment.SubjectId,
            assignment.Semester,
            assignment.DueAt,
            assignment.IsActive,
            assignment.AssignedChildIds,
            assignment.CreatedById,
            dbContext.Users.Where(user => user.Id == assignment.CreatedById).Select(user => user.DisplayName).FirstOrDefault(),
            assignment.CreatedOn,
            studentId == null
                ? null
                : dbContext.Participations
                    .Where(participation => participation.HomeworkId == assignment.Id && participation.ChildId == studentId)
                    .OrderByDescending(participation => participation.EndedOn)
                    .Select(participation => new SubmissionStatusDto(
                        participation.Id, participation.ScorePercent, participation.PendingReviewCount,
                        participation.ValidationStatus, participation.EndedOn))
                    .FirstOrDefault());
}
