using QuizMaster.Application.Features.Users.DeactivateUser;

namespace QuizMaster.API.Endpoints.Users;

public static class DeactivateUserEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/users/{id:int}:deactivate", async (int id, ISender sender) => Results.Ok(await sender.Send(new DeactivateUserCommand { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("DeactivateUser")
        .WithTags("Users")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
