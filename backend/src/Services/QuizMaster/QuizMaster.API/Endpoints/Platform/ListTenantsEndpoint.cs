using QuizMaster.Application.Features.Platform.ListTenants;

namespace QuizMaster.API.Endpoints.Platform;

public static class ListTenantsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/platform/tenants", async ([AsParameters] ListTenantsQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.PlatformAdmin)
        .WithName("ListTenants")
        .WithTags("Platform")
        .Produces<PagedResponse<TenantDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
