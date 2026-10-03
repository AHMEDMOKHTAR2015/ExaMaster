using QuizMaster.Application.Features.Assignments.Shared;

namespace QuizMaster.Application.Features.Assignments.GetAssignmentResults;

public class GetAssignmentResultsQueryHandler(QuizMasterDbContext _dbContext, IClaimsProvider _claimsProvider)
    : IRequestHandler<GetAssignmentResultsQuery, GetAssignmentResultsResponse>
{
    public async Task<GetAssignmentResultsResponse> Handle(GetAssignmentResultsQuery query, CancellationToken ct)
    {
        var callerId = _claimsProvider.GetUserId();

        var assignments = await _dbContext.Assignments.AsNoTracking()
            .Where(assignment => assignment.CreatedById == callerId)
            .Matching(query.Filter(), _dbContext)
            .Select(assignment => new
            {
                assignment.Id,
                assignment.ClassId,
                assignment.AssignedChildIds,
                assignment.DueAt,
                SubjectId = assignment.SubjectId
                    ?? _dbContext.TeacherQuizzes.Where(quiz => quiz.Id == assignment.TeacherQuizId).Select(quiz => (int?)quiz.SubjectId).FirstOrDefault()
                    ?? _dbContext.BankQuizzes.Where(quiz => quiz.Id == assignment.BankQuizId).Select(quiz => quiz.SubjectId).FirstOrDefault(),
                Semester = assignment.Semester
                    ?? _dbContext.TeacherQuizzes.Where(quiz => quiz.Id == assignment.TeacherQuizId).Select(quiz => quiz.Semester).FirstOrDefault()
                    ?? _dbContext.BankQuizzes.Where(quiz => quiz.Id == assignment.BankQuizId).Select(quiz => quiz.Semester).FirstOrDefault()
            })
            .ToListAsync(ct);
        if (assignments.Count == 0)
            return new GetAssignmentResultsResponse([]);

        // who each assignment is set for: the students it names, else the active students of its group
        var classIds = assignments.Where(assignment => assignment.AssignedChildIds.Count == 0).Select(assignment => assignment.ClassId).Distinct().ToList();
        var studentsByClass = (await _dbContext.Users.AsNoTracking()
                .Where(user => user.ClassId != null && classIds.Contains(user.ClassId.Value)
                    && user.IsActive && user.Roles.Contains(UserRoleType.STUDENT))
                .Select(user => new { user.Id, ClassId = user.ClassId!.Value })
                .ToListAsync(ct))
            .ToLookup(student => student.ClassId, student => student.Id);

        // each student's latest submission to each assignment
        var assignmentIds = assignments.Select(assignment => (int?)assignment.Id).ToList();
        var latest = (await _dbContext.Participations.AsNoTracking()
                .Where(participation => assignmentIds.Contains(participation.HomeworkId))
                .Select(participation => new
                {
                    HomeworkId = participation.HomeworkId!.Value, participation.ChildId, participation.EndedOn, participation.Id,
                    participation.ScorePercent, IsValidated = participation.ValidationStatus != null
                })
                .ToListAsync(ct))
            .GroupBy(submission => submission.HomeworkId)
            .ToDictionary(
                byAssignment => byAssignment.Key,
                byAssignment => (IReadOnlyDictionary<int, LatestSubmission>)byAssignment
                    .GroupBy(submission => submission.ChildId)
                    .ToDictionary(
                        byStudent => byStudent.Key,
                        byStudent => byStudent.OrderByDescending(s => s.EndedOn).ThenByDescending(s => s.Id)
                            .Select(s => new LatestSubmission(s.ScorePercent, s.IsValidated)).First()));

        var now = DateTime.UtcNow;
        IReadOnlyDictionary<int, LatestSubmission> none = new Dictionary<int, LatestSubmission>();
        return new GetAssignmentResultsResponse(assignments
            .Select(assignment =>
            {
                var targets = assignment.AssignedChildIds.Count > 0 ? assignment.AssignedChildIds : studentsByClass[assignment.ClassId].ToList();
                var progress = AssignmentProgress.Of(targets, latest.GetValueOrDefault(assignment.Id) ?? none, assignment.DueAt, now);
                return new AssignmentResultDto(
                    assignment.Id, assignment.SubjectId, assignment.Semester,
                    progress.Targeted, progress.Completed, progress.NotStarted, progress.Overdue, progress.Validated,
                    progress.CompletionRate, progress.AverageScore);
            })
            .ToList());
    }
}
