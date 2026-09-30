using QuizMaster.Application.Features.Academic.ListClasses;

namespace QuizMaster.API.Endpoints.Academic;

public static class ListClassesEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/classes", async ([AsParameters] ListClassesQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.Member)
        .WithName("ListClasses")
        .WithTags("Classes")
        .Produces<ListClassesResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
