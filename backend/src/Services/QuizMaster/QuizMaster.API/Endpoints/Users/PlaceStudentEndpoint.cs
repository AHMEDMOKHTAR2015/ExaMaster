using QuizMaster.Application.Features.Users.PlaceStudent;

namespace QuizMaster.API.Endpoints.Users;

public static class PlaceStudentEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/users/{id:int}/placement", async (int id, PlaceStudentCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("PlaceStudent")
        .WithTags("Users")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
