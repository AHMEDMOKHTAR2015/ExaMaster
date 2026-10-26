using QuizMasterPro.Security;
using QuizMaster.Application.Features.TeachingRooms.Shared;

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

            //insight - a teacher reads and deletes only the material they uploaded (the administrator returned above)
            nameof(TeachingMaterial) => isTeacher
                && await _dbContext.TeachingMaterials.AnyAsync(material => material.Id == id && material.CreatedById == caller, ct),

            //insight - the presenting teacher acts on their room; a student reaches one their class's material is presented in
            // (to ask to join) or one they already asked to join. What each may then see is the handler's call (the board:
            // admitted only), all from the same rule as the hub's
            nameof(TeachingRoom) => await _dbContext.AdmissionAsync(id, caller, roles, ct) != TeachingRoomAdmission.None,

            nameof(HomeworkAssignment) => isTeacher
                && await _dbContext.Assignments.AnyAsync(assignment => assignment.Id == id && assignment.CreatedById == caller, ct),

            nameof(QuizAttemptLock) => isTeacher
                || await _dbContext.AttemptLocks.AnyAsync(attemptLock => attemptLock.Id == id && attemptLock.ChildId == caller, ct),

            _ => false                                                         // an aggregate nobody taught this checker about: deny
        };
    }
}
