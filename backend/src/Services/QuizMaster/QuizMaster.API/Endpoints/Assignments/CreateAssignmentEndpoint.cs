using QuizMaster.Application.Features.Assignments.CreateAssignment;

namespace QuizMaster.API.Endpoints.Assignments;

public static class CreateAssignmentEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/assignments", async (CreateAssignmentCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/assignments/{response.Id}", response);
        })
        .RequireRoleAuthorization(Role.Teacher, Role.ApplicationAdmin)
        .WithName("CreateAssignment")
        .WithTags("Assignments")
        .Produces<IdResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
