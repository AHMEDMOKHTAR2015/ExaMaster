using QuizMaster.Application.Features.Dashboard.GetDashboardStats;

namespace QuizMaster.API.Endpoints.Dashboard;

public static class GetDashboardStatsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/dashboard/stats", async (ISender sender) => Results.Ok(await sender.Send(new GetDashboardStatsQuery())))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("GetDashboardStats")
        .WithTags("Dashboard")
        .Produces<DashboardStatsResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
