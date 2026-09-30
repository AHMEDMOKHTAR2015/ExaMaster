using QuizMaster.Application.Features.Platform.SuspendTenant;

namespace QuizMaster.API.Endpoints.Platform;

public static class SuspendTenantEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/platform/tenants/{id:int}:suspend", async (int id, ISender sender) => Results.Ok(await sender.Send(new SuspendTenantCommand { AggregateId = id })))
        .RequireRoleAuthorization(Role.PlatformAdmin)
        .WithName("SuspendTenant")
        .WithTags("Platform")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
