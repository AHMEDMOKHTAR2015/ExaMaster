using QuizMaster.Application.Features.Users.GetCurrentUser;

namespace QuizMaster.API.Endpoints.Users;

public static class GetCurrentUserEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/me", async (ISender sender) => Results.Ok(await sender.Send(new GetCurrentUserQuery())))
        .RequireAuthorization()
        .WithName("GetCurrentUser")
        .WithTags("Me")
        .Produces<GetCurrentUserResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized);
    }
}
