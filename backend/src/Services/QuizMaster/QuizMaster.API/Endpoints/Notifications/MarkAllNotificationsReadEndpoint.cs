using QuizMaster.Application.Features.Notifications.MarkAllNotificationsRead;

namespace QuizMaster.API.Endpoints.Notifications;

public static class MarkAllNotificationsReadEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/me/notifications:read-all", async (ISender sender) => Results.Ok(await sender.Send(new MarkAllNotificationsReadCommand())))
        .RequireRoleAuthorization(Role.Member)
        .WithName("MarkAllNotificationsRead")
        .WithTags("Me")
        .Produces<MarkAllNotificationsReadResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
