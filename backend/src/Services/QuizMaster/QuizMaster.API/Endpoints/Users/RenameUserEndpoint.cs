using QuizMaster.Application.Features.Users.RenameUser;

namespace QuizMaster.API.Endpoints.Users;

public static class RenameUserEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/users/{id:int}/name", async (int id, RenameUserCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("RenameUser")
        .WithTags("Users")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
