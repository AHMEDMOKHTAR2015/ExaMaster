using QuizMaster.Application.Features.Users.SearchUsers;

namespace QuizMaster.API.Endpoints.Users;

public static class SearchUsersEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/users", async ([AsParameters] SearchUsersQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.Staff)
        .WithName("SearchUsers")
        .WithTags("Users")
        .Produces<PagedResponse<UserDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
