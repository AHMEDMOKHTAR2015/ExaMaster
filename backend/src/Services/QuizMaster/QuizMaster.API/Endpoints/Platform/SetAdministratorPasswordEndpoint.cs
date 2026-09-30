using QuizMaster.Application.Features.Platform.SetAdministratorPassword;

namespace QuizMaster.API.Endpoints.Platform;

public static class SetAdministratorPasswordEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/platform/tenants/{id:int}/administrator-password", async (int id, SetAdministratorPasswordCommand command, ISender sender) =>
            Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization(Role.PlatformAdmin)
        .WithName("SetAdministratorPassword")
        .WithTags("Platform")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status409Conflict);
    }
}
