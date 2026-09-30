using QuizMaster.Application.Features.Assignments.GetAssignment;

namespace QuizMaster.API.Endpoints.Assignments;

public static class GetAssignmentEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/assignments/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new GetAssignmentQuery(id))))
        .RequireRoleAuthorization(Role.Member)
        .WithName("GetAssignment")
        .WithTags("Assignments")
        .Produces<GetAssignmentResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
