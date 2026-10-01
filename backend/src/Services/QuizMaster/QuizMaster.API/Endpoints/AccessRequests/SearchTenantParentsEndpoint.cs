using QuizMaster.Application.Features.AccessRequests.SearchTenantParents;

namespace QuizMaster.API.Endpoints.AccessRequests;

public static class SearchTenantParentsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        // For approving a child's access request: the parents of the organization the reviewer chose.
        app.MapGet("/platform/tenants/{id:int}/parents", async (int id, string? search, ISender sender) =>
            Results.Ok(await sender.Send(new SearchTenantParentsQuery(id, search))))
        .RequireRoleAuthorization(Role.PlatformAdmin)
        .WithName("SearchTenantParents")
        .WithTags("AccessRequests")
        .Produces<IReadOnlyList<TenantParentOptionDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
