using QuizMaster.Application.Features.Auth.RefreshSession;
using QuizMaster.Application.SignIn;

namespace QuizMaster.API.Endpoints.Auth;

public static class RefreshSessionEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/auth/refresh", async (RefreshSessionCommand command, ISender sender) => Results.Ok(await sender.Send(command)))
        .AllowAnonymous()
        .RequireRateLimiting(RateLimits.SessionRefresh)
        .WithName("RefreshSession")
        .WithTags("Sign-in")
        .Produces<SessionTokens>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status429TooManyRequests)
        .ProducesProblem(StatusCodes.Status401Unauthorized);
    }
}
