using QuizMaster.Application.Features.Academic.UpdateStage;

namespace QuizMaster.API.Endpoints.Academic;

public static class UpdateStageEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/stages/{id:int}", async (int id, UpdateStageCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("UpdateStage")
        .WithTags("Stages")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
