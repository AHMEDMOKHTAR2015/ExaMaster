using QuizMaster.Application.Features.Notifications.ListMyNotifications;

namespace QuizMaster.API.Endpoints.Notifications;

public static class ListMyNotificationsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/me/notifications", async ([AsParameters] ListMyNotificationsQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.Member)
        .WithName("ListMyNotifications")
        .WithTags("Me")
        .Produces<ListMyNotificationsResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
