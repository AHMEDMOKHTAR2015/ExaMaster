using QuizMaster.Application.Features.Participations.GetParticipation;
using QuizMaster.Domain.Participations;

namespace QuizMaster.API.Endpoints.Participations;

public static class GetParticipationEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/participations/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new GetParticipationQuery(id))))
        .RequireRoleAuthorization<Participation>(Role.Member)
        .WithName("GetParticipation")
        .WithTags("Participations")
        .Produces<GetParticipationResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
