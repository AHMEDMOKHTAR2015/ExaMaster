namespace QuizMaster.Application.Features.Dashboard.GetDashboardStats;

// The administrator dashboard's tiles. Counted on demand: a relational query replaces the app's trigger-maintained
// dashboardStats document and its recompute function.
public record GetDashboardStatsQuery : IQuery<DashboardStatsResponse>;

public record DashboardStatsResponse(
    int Students,
    int Teachers,
    int Parents,
    int Administrators,
    int Stages,
    int Classes,
    int Subjects,
    int BankQuestions,
    int BankQuizzes,
    int TeacherQuizzes,
    int ActiveAssignments,
    int Submissions,
    int AwaitingReview,
    int RegistrationKeys);
