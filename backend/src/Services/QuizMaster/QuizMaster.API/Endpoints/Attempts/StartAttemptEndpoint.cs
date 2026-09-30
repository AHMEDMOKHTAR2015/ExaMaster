using QuizMaster.Application.Features.Attempts.StartAttempt;

namespace QuizMaster.API.Endpoints.Attempts;

public static class StartAttemptEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/attempt-locks", async (StartAttemptCommand command, ISender sender) => Results.Ok(await sender.Send(command)))
        .RequireRoleAuthorization(Role.Member)
        .WithName("StartAttempt")
        .WithTags("Sitting a quiz")
        .Produces<AttemptLockDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
