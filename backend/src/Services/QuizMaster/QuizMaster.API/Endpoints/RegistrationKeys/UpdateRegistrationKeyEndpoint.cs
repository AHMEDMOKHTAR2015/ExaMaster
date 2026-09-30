using QuizMaster.Application.Features.RegistrationKeys.UpdateRegistrationKey;

namespace QuizMaster.API.Endpoints.RegistrationKeys;

public static class UpdateRegistrationKeyEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/registration-keys/{id:int}", async (int id, UpdateRegistrationKeyCommand command, ISender sender)
            => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("UpdateRegistrationKey")
        .WithTags("Registration keys")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
