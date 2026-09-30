using QuizMaster.Application.Features.Assignments.UpdateAssignment;
using QuizMaster.Domain.Assignments;

namespace QuizMaster.API.Endpoints.Assignments;

public static class UpdateAssignmentEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/assignments/{id:int}", async (int id, UpdateAssignmentCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization<HomeworkAssignment>(Role.Teacher, Role.ApplicationAdmin)
        .WithName("UpdateAssignment")
        .WithTags("Assignments")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
