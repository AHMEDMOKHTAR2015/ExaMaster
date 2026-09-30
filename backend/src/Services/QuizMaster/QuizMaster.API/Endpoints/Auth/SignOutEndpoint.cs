using QuizMaster.Application.Features.Auth.SignOut;

namespace QuizMaster.API.Endpoints.Auth;

public static class SignOutEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/auth/sign-out", async (SignOutCommand command, ISender sender) =>
        {
            await sender.Send(command);
            return Results.NoContent();
        })
        .AllowAnonymous()
        .WithName("SignOut")
        .WithTags("Sign-in")
        .Produces(StatusCodes.Status204NoContent)
        .ProducesProblem(StatusCodes.Status400BadRequest);
    }
}
