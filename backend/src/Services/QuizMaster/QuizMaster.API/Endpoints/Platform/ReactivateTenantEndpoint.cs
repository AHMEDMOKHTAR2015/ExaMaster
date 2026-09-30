using QuizMaster.Application.Features.Platform.ReactivateTenant;

namespace QuizMaster.API.Endpoints.Platform;

public static class ReactivateTenantEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/platform/tenants/{id:int}:reactivate", async (int id, ISender sender) => Results.Ok(await sender.Send(new ReactivateTenantCommand { AggregateId = id })))
        .RequireRoleAuthorization(Role.PlatformAdmin)
        .WithName("ReactivateTenant")
        .WithTags("Platform")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
