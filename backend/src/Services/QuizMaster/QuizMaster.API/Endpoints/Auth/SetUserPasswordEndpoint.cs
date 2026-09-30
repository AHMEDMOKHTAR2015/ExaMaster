using QuizMaster.Application.Features.Auth.SetUserPassword;

namespace QuizMaster.API.Endpoints.Auth;

public static class SetUserPasswordEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        // Administrators for anyone in their school; parents for their own children (checked in the handler).
        app.MapPut("/users/{id:int}/password", async (int id, SetUserPasswordCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireAuthorization(policy => policy.RequireRole(Role.ApplicationAdmin, Role.Parent))
        .WithName("SetUserPassword")
        .WithTags("Sign-in")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status409Conflict);
    }
}
