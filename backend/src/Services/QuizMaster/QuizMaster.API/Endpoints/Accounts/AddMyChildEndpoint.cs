using QuizMaster.Application.Features.Accounts.AddMyChild;

namespace QuizMaster.API.Endpoints.Accounts;

public static class AddMyChildEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/me/children", async (AddMyChildCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/users/{response.Id}", response);
        })
        .RequireRoleAuthorization(Role.Parent)
        .WithName("AddMyChild")
        .WithTags("Me")
        .Produces<IdResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
