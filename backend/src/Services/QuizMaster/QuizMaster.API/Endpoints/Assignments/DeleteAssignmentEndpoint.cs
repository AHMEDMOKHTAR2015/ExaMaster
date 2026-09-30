using QuizMaster.Application.Features.Assignments.DeleteAssignment;
using QuizMaster.Domain.Assignments;

namespace QuizMaster.API.Endpoints.Assignments;

public static class DeleteAssignmentEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/assignments/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new DeleteAssignmentCommand { AggregateId = id })))
        .RequireRoleAuthorization<HomeworkAssignment>(Role.Teacher, Role.ApplicationAdmin)
        .WithName("DeleteAssignment")
        .WithTags("Assignments")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
