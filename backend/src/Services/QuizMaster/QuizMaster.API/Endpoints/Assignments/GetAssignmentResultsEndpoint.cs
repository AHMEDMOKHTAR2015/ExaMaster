using QuizMaster.Application.Features.Assignments.GetAssignmentResults;

namespace QuizMaster.API.Endpoints.Assignments;

public static class GetAssignmentResultsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/assignments/results", async ([AsParameters] GetAssignmentResultsQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.Staff)
        .WithName("GetAssignmentResults")
        .WithTags("Assignments")
        .Produces<GetAssignmentResultsResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
