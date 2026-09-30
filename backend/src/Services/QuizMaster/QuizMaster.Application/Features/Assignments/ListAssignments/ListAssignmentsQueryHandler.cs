using QuizMaster.Application.Features.Assignments.Shared;

namespace QuizMaster.Application.Features.Assignments.ListAssignments;

public class ListAssignmentsQueryHandler(QuizMasterDbContext _dbContext, IClaimsProvider _claimsProvider)
    : IRequestHandler<ListAssignmentsQuery, ListAssignmentsResponse>
{
    public async Task<ListAssignmentsResponse> Handle(ListAssignmentsQuery query, CancellationToken ct)
    {
        var caller = Caller.From(_claimsProvider);
        var assignments = _dbContext.Assignments.AsNoTracking();

        if (caller.IsStaff)
        {
            if (!query.IncludeInactive)
                assignments = assignments.Where(assignment => assignment.IsActive);
            if (query.ClassId is { } classId)
                assignments = assignments.Where(assignment => assignment.ClassId == classId);
            if (query.Mine)
                assignments = assignments.Where(assignment => assignment.CreatedById == caller.UserId);

            return new ListAssignmentsResponse(await assignments
                .OrderByDescending(assignment => assignment.DueAt)
                .ToDtos(_dbContext, submissionsOfStudentId: null)
                .ToListAsync(ct));
        }

        var student = await ResolveStudentAsync(caller, query.ChildId, ct);

        return new ListAssignmentsResponse(await assignments
            .Where(assignment => assignment.IsActive)
            .SetFor(student.Id, student.ClassId, student.StageId)
            .OrderBy(assignment => assignment.DueAt)
            .ToDtos(_dbContext, submissionsOfStudentId: student.Id)
            .ToListAsync(ct));
    }

    // A parent looks through one of their children; anyone else looks at their own list.
    private async Task<(int Id, int? ClassId, int? StageId)> ResolveStudentAsync(Caller caller, int? childId, CancellationToken ct)
    {
        var studentId = caller.IsParent
            ? childId ?? throw new BadRequestException("Choose which child's assignments to list (childId).")
            : caller.UserId;

        var student = await _dbContext.Users.AsNoTracking()
            .Where(user => user.Id == studentId && (user.Id == caller.UserId || user.ParentId == caller.UserId))
            .Select(user => new { user.Id, user.ClassId, user.StageId })
            .SingleOrDefaultAsync(ct)
            ?? throw new ForbiddenException("You can only list your own assignments or your children's.");

        return (student.Id, student.ClassId, student.StageId);
    }
}
