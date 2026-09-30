using QuizMaster.Application.Features.Attempts.RecordAttemptExit;
using QuizMaster.Domain.AttemptLocks;

namespace QuizMaster.API.Endpoints.Attempts;

public static class RecordAttemptExitEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/attempt-locks/{id:int}:exit", async (int id, RecordAttemptExitCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization<QuizAttemptLock>(Role.Student, Role.Parent)
        .WithName("RecordAttemptExit")
        .WithTags("Sitting a quiz")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
