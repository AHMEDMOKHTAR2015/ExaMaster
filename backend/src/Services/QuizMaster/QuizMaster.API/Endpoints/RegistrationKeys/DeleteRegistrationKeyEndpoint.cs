using QuizMaster.Application.Features.RegistrationKeys.DeleteRegistrationKey;

namespace QuizMaster.API.Endpoints.RegistrationKeys;

public static class DeleteRegistrationKeyEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/registration-keys/{id:int}", async (int id, ISender sender)
            => Results.Ok(await sender.Send(new DeleteRegistrationKeyCommand { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("DeleteRegistrationKey")
        .WithTags("Registration keys")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
