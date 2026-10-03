using QuizMaster.Application.Features.Dashboard.GetMySubjectPerformance;

namespace QuizMaster.API.Endpoints.Dashboard;

public static class GetMySubjectPerformanceEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/me/subject-performance", async (ISender sender) => Results.Ok(await sender.Send(new GetMySubjectPerformanceQuery())))
        .RequireRoleAuthorization(Role.Student)
        .WithName("GetMySubjectPerformance")
        .WithTags("Dashboard")
        .Produces<IReadOnlyList<SubjectPerformanceDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
