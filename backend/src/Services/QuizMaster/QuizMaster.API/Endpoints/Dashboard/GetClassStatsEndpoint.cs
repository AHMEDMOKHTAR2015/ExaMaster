using QuizMaster.Application.Features.Dashboard.GetClassStats;

namespace QuizMaster.API.Endpoints.Dashboard;

public static class GetClassStatsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/classes/{id:int}/stats", async (int id, ISender sender) => Results.Ok(await sender.Send(new GetClassStatsQuery(id))))
        .RequireRoleAuthorization(Role.Staff)
        .WithName("GetClassStats")
        .WithTags("Dashboard")
        .Produces<ClassStatsResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
