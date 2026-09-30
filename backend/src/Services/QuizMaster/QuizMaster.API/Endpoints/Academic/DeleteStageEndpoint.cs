using QuizMaster.Application.Features.Academic.DeleteStage;

namespace QuizMaster.API.Endpoints.Academic;

public static class DeleteStageEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/stages/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new DeleteStageCommand { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("DeleteStage")
        .WithTags("Stages")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
