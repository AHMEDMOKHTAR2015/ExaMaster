using QuizMaster.Application.Features.Platform.GetTenant;

namespace QuizMaster.API.Endpoints.Platform;

public static class GetTenantEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/platform/tenants/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new GetTenantQuery(id))))
        .RequireRoleAuthorization(Role.PlatformAdmin)
        .WithName("GetTenant")
        .WithTags("Platform")
        .Produces<TenantDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
