using QuizMaster.Application.Features.Accounts.CreateAccount;

namespace QuizMaster.API.Endpoints.Accounts;

public static class CreateAccountEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/users", async (CreateAccountCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/users/{response.Id}", response);
        })
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("CreateAccount")
        .WithTags("Users")
        .Produces<IdResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
