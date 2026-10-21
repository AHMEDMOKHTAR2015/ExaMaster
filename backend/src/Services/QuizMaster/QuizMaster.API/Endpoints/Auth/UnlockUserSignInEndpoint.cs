using QuizMaster.Application.Features.Auth.UnlockUserSignIn;

namespace QuizMaster.API.Endpoints.Auth;

public static class UnlockUserSignInEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/users/{id:int}:unlock", async (int id, ISender sender) => Results.Ok(await sender.Send(new UnlockUserSignInCommand { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("UnlockUserSignIn")
        .WithTags("Sign-in")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
