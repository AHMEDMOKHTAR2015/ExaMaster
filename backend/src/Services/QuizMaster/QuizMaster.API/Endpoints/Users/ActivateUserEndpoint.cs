using QuizMaster.Application.Features.Users.ActivateUser;

namespace QuizMaster.API.Endpoints.Users;

public static class ActivateUserEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/users/{id:int}:activate", async (int id, ISender sender) => Results.Ok(await sender.Send(new ActivateUserCommand { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("ActivateUser")
        .WithTags("Users")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
