using QuizMaster.Application.Features.Dashboard.GetChildSubjectPerformance;
using QuizMaster.Application.Features.Dashboard.GetMySubjectPerformance;

namespace QuizMaster.API.Endpoints.Dashboard;

public static class GetChildSubjectPerformanceEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/me/children/{id:int}/subject-performance", async (int id, ISender sender) =>
            Results.Ok(await sender.Send(new GetChildSubjectPerformanceQuery(id))))
        .RequireRoleAuthorization(Role.Parent)
        .WithName("GetChildSubjectPerformance")
        .WithTags("Dashboard")
        .Produces<IReadOnlyList<SubjectPerformanceDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
