using QuizMaster.Application.Features.Participations.DeleteParticipation;

namespace QuizMaster.API.Endpoints.Participations;

public static class DeleteParticipationEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/participations/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new DeleteParticipationCommand { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("DeleteParticipation")
        .WithTags("Participations")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
