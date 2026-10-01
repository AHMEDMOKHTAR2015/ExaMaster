using QuizMaster.Application.Features.AccessRequests.ListAccessRequests;

namespace QuizMaster.API.Endpoints.AccessRequests;

public static class ListAccessRequestsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/platform/access-requests", async ([AsParameters] ListAccessRequestsQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.PlatformAdmin)
        .WithName("ListAccessRequests")
        .WithTags("AccessRequests")
        .Produces<PagedResponse<AccessRequestDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
