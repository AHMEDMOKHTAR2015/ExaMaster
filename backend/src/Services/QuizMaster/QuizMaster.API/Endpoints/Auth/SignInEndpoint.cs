using QuizMaster.Application.Features.Auth.SignIn;
using QuizMaster.Application.SignIn;

namespace QuizMaster.API.Endpoints.Auth;

public static class SignInEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/auth/sign-in", async (SignInCommand command, ISender sender) => Results.Ok(await sender.Send(command)))
        .AllowAnonymous()
        .WithName("SignIn")
        .WithTags("Sign-in")
        .Produces<SessionTokens>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized);
    }
}
