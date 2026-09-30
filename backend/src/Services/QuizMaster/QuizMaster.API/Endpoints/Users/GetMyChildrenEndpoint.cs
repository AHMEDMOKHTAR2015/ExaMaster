using QuizMaster.Application.Features.Users.GetMyChildren;

namespace QuizMaster.API.Endpoints.Users;

public static class GetMyChildrenEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/me/children", async (ISender sender) => Results.Ok(await sender.Send(new GetMyChildrenQuery())))
        .RequireRoleAuthorization(Role.Parent)
        .WithName("GetMyChildren")
        .WithTags("Me")
        .Produces<GetMyChildrenResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
