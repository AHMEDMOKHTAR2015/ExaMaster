using QuizMaster.Application.Features.Academic.ListGrades;

namespace QuizMaster.API.Endpoints.Academic;

public static class ListGradesEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/grades", async ([AsParameters] ListGradesQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.Member)
        .WithName("ListGrades")
        .WithTags("Grades")
        .Produces<ListGradesResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
