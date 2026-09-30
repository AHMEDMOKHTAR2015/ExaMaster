using QuizMaster.Application.Features.Assignments.GetAssignmentSitting;

namespace QuizMaster.API.Endpoints.Assignments;

public static class GetAssignmentSittingEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/assignments/{id:int}/sitting", async (int id, ISender sender) => Results.Ok(await sender.Send(new GetAssignmentSittingQuery(id))))
        .RequireRoleAuthorization(Role.Member)
        .WithName("GetAssignmentSitting")
        .WithTags("Assignments")
        .Produces<SittingDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
