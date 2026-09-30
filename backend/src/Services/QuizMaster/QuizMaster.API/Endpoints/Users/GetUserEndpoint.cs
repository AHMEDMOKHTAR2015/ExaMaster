using QuizMaster.Application.Features.Users.GetUser;
using QuizMaster.Domain.Users;

namespace QuizMaster.API.Endpoints.Users;

public static class GetUserEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/users/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new GetUserQuery(id))))
        .RequireRoleAuthorization<User>(Role.Member)
        .WithName("GetUser")
        .WithTags("Users")
        .Produces<GetUserResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
