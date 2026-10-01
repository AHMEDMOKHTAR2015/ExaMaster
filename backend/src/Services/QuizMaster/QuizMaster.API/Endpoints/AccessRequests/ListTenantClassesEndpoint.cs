using QuizMaster.Application.Features.AccessRequests.ListTenantClasses;

namespace QuizMaster.API.Endpoints.AccessRequests;

public static class ListTenantClassesEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        // For approving a child's access request: the classes of the organization the reviewer chose.
        app.MapGet("/platform/tenants/{id:int}/classes", async (int id, ISender sender) => Results.Ok(await sender.Send(new ListTenantClassesQuery(id))))
        .RequireRoleAuthorization(Role.PlatformAdmin)
        .WithName("ListTenantClasses")
        .WithTags("AccessRequests")
        .Produces<IReadOnlyList<TenantClassOptionDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
