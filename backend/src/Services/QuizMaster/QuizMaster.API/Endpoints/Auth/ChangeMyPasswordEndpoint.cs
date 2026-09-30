using QuizMaster.Application.Features.Auth.ChangeMyPassword;

namespace QuizMaster.API.Endpoints.Auth;

public static class ChangeMyPasswordEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/me/password", async (ChangeMyPasswordCommand command, ISender sender) => Results.Ok(await sender.Send(command)))
        .RequireAuthorization()
        .WithName("ChangeMyPassword")
        .WithTags("Sign-in")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized);
    }
}
