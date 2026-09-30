using QuizMaster.Application.Features.Participations.Shared;

namespace QuizMaster.Application.Features.Dashboard.GetDashboardStats;

public class GetDashboardStatsQueryHandler(QuizMasterDbContext _dbContext)
    : IRequestHandler<GetDashboardStatsQuery, DashboardStatsResponse>
{
    public async Task<DashboardStatsResponse> Handle(GetDashboardStatsQuery query, CancellationToken ct)
    {
        var activeUsers = _dbContext.Users.Where(user => user.IsActive);

        return new DashboardStatsResponse(
            Students: await activeUsers.CountAsync(user => user.Roles.Contains(UserRoleType.STUDENT), ct),
            Teachers: await activeUsers.CountAsync(user => user.Roles.Contains(UserRoleType.TEACHER), ct),
            Parents: await activeUsers.CountAsync(user => user.Roles.Contains(UserRoleType.PARENT), ct),
            Administrators: await activeUsers.CountAsync(user => user.Roles.Contains(UserRoleType.APPLICATION_ADMIN), ct),
            Stages: await _dbContext.Stages.CountAsync(ct),
            Classes: await _dbContext.Classes.CountAsync(ct),
            Subjects: await _dbContext.Subjects.CountAsync(ct),
            BankQuestions: await _dbContext.Questions.CountAsync(ct),
            BankQuizzes: await _dbContext.BankQuizzes.CountAsync(ct),
            TeacherQuizzes: await _dbContext.TeacherQuizzes.CountAsync(ct),
            ActiveAssignments: await _dbContext.Assignments.CountAsync(assignment => assignment.IsActive, ct),
            Submissions: await _dbContext.Participations.CountAsync(ct),
            AwaitingReview: await _dbContext.Participations.AwaitingReview().CountAsync(ct),
            RegistrationKeys: await _dbContext.RegistrationKeys.CountAsync(ct));
    }
}
