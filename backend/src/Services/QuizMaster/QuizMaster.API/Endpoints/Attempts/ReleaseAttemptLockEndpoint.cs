using QuizMaster.Application.Features.Attempts.ReleaseAttemptLock;
using QuizMaster.Domain.AttemptLocks;

namespace QuizMaster.API.Endpoints.Attempts;

public static class ReleaseAttemptLockEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/attempt-locks/{id:int}:release", async (int id, ISender sender) => Results.Ok(await sender.Send(new ReleaseAttemptLockCommand { AggregateId = id })))
        .RequireRoleAuthorization<QuizAttemptLock>(Role.Staff)
        .WithName("ReleaseAttemptLock")
        .WithTags("Sitting a quiz")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
