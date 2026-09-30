using QuizMaster.Application.Features.Attempts.ListMyAttemptLocks;

namespace QuizMaster.API.Endpoints.Attempts;

public static class ListMyAttemptLocksEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/attempt-locks/mine", async (ISender sender) => Results.Ok(await sender.Send(new ListMyAttemptLocksQuery())))
        .RequireRoleAuthorization(Role.Member)
        .WithName("ListMyAttemptLocks")
        .WithTags("Sitting a quiz")
        .Produces<ListMyAttemptLocksResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
