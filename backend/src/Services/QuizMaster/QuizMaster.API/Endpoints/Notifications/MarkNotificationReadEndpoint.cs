using QuizMaster.Application.Features.Notifications.MarkNotificationRead;

namespace QuizMaster.API.Endpoints.Notifications;

public static class MarkNotificationReadEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/me/notifications/{id:int}:read", async (int id, ISender sender) => Results.Ok(await sender.Send(new MarkNotificationReadCommand { AggregateId = id })))
        .RequireRoleAuthorization(Role.Member)
        .WithName("MarkNotificationRead")
        .WithTags("Me")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
