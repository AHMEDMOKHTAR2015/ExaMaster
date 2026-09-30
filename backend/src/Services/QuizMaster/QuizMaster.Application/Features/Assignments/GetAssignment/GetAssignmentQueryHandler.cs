using QuizMaster.Application.Features.Assignments.Shared;

namespace QuizMaster.Application.Features.Assignments.GetAssignment;

public class GetAssignmentQueryHandler(QuizMasterDbContext _dbContext, IClaimsProvider _claimsProvider)
    : IRequestHandler<GetAssignmentQuery, GetAssignmentResponse>
{
    public async Task<GetAssignmentResponse> Handle(GetAssignmentQuery query, CancellationToken ct)
    {
        var caller = Caller.From(_claimsProvider);
        var assignments = _dbContext.Assignments.AsNoTracking().Where(assignment => assignment.Id == query.Id);

        if (caller.IsStaff)
            return new GetAssignmentResponse(Guard.NotFound(await assignments.ToDtos(_dbContext, null).SingleOrDefaultAsync(ct)));

        // The caller, or (for a parent) any of their children, must be among the assignment's students.
        var students = await _dbContext.Users.AsNoTracking()
            .Where(user => user.Id == caller.UserId || user.ParentId == caller.UserId)
            .Select(user => new { user.Id, user.ClassId, user.StageId })
            .ToListAsync(ct);

        foreach (var student in students)
        {
            var visible = await assignments.SetFor(student.Id, student.ClassId, student.StageId)
                .ToDtos(_dbContext, submissionsOfStudentId: student.Id)
                .SingleOrDefaultAsync(ct);
            if (visible is not null)
                return new GetAssignmentResponse(visible);
        }

        throw new NotFoundException("Assignment not found");
    }
}
