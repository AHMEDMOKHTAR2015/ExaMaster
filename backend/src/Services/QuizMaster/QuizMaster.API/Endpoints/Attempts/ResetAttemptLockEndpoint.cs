using QuizMaster.Application.Features.Attempts.ResetAttemptLock;
using QuizMaster.Domain.AttemptLocks;

namespace QuizMaster.API.Endpoints.Attempts;

public static class ResetAttemptLockEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/attempt-locks/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new ResetAttemptLockCommand { AggregateId = id })))
        .RequireRoleAuthorization<QuizAttemptLock>(Role.Staff)
        .WithName("ResetAttemptLock")
        .WithTags("Sitting a quiz")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
