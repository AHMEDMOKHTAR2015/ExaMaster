using QuizMaster.Application.Features.Assignments.ListAssignments;

namespace QuizMaster.API.Endpoints.Assignments;

public static class ListAssignmentsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/assignments", async ([AsParameters] ListAssignmentsQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.Member)
        .WithName("ListAssignments")
        .WithTags("Assignments")
        .Produces<ListAssignmentsResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
