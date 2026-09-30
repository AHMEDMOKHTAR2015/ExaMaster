using QuizMaster.Application.Features.Platform.UpdateTenant;

namespace QuizMaster.API.Endpoints.Platform;

public static class UpdateTenantEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/platform/tenants/{id:int}", async (int id, UpdateTenantCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization(Role.PlatformAdmin)
        .WithName("UpdateTenant")
        .WithTags("Platform")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
