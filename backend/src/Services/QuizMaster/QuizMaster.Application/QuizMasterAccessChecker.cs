using QuizMasterPro.Security;

namespace QuizMaster.Application;

// Layer 2 of authorization, answered from this service's OWN data: "may this caller act on THIS aggregate?"
// Staff read everything in their tenant, a teacher changes only what they authored,
// a student reaches their own records and a parent their children's.
public class QuizMasterAccessChecker(QuizMasterDbContext _dbContext) : IAggregateAccessChecker
{
    public async Task<bool> HasAccessAsync(Type? aggregateType, int? aggregateId, int? userId, IReadOnlySet<UserRoleType> roles, CancellationToken ct = default)
    {
        if (aggregateType is null || aggregateId is null)                    // the endpoint checks roles only
            return true;

        if (userId is null || roles.IsNullOrEmpty())
            return false;

        //insight - an administrator reaches everything inside their own tenant; the tenant query filter keeps it there
        if (roles.Contains(UserRoleType.APPLICATION_ADMIN))
            return true;

        var id = aggregateId.Value;
        var caller = userId.Value;
        var isTeacher = roles.Contains(UserRoleType.TEACHER);

        return aggregateType.Name switch
        {
            nameof(User) => isTeacher || id == caller
                || await _dbContext.Users.AnyAsync(user => user.Id == id && user.ParentId == caller, ct),

            nameof(Participation) => isTeacher
                || await _dbContext.Participations.AnyAsync(p => p.Id == id && (p.ChildId == caller || p.ParentId == caller), ct),

            nameof(TeacherQuiz) => isTeacher
                && await _dbContext.TeacherQuizzes.AnyAsync(quiz => quiz.Id == id && quiz.CreatedById == caller, ct),

            nameof(HomeworkAssignment) => isTeacher
                && await _dbContext.Assignments.AnyAsync(assignment => assignment.Id == id && assignment.CreatedById == caller, ct),

            nameof(QuizAttemptLock) => isTeacher
                || await _dbContext.AttemptLocks.AnyAsync(attemptLock => attemptLock.Id == id && attemptLock.ChildId == caller, ct),

            _ => false                                                         // an aggregate nobody taught this checker about: deny
        };
    }
}
