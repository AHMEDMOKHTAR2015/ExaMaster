using QuizMaster.Application.Features.RegistrationKeys.CreateRegistrationKey;

namespace QuizMaster.API.Endpoints.RegistrationKeys;

public static class CreateRegistrationKeyEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/registration-keys", async (CreateRegistrationKeyCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/registration-keys/{response.Id}", response);
        })
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("CreateRegistrationKey")
        .WithTags("Registration keys")
        .Produces<RegistrationKeyDto>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
