using QuizMaster.Application.Features.Attempts.ListAttemptLocks;

namespace QuizMaster.API.Endpoints.Attempts;

public static class ListAttemptLocksEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/attempt-locks", async ([AsParameters] ListAttemptLocksQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.Staff)
        .WithName("ListAttemptLocks")
        .WithTags("Sitting a quiz")
        .Produces<ListAttemptLocksResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
