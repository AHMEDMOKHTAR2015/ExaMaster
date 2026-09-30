using QuizMaster.Application.Features.Participations.SearchParticipations;

namespace QuizMaster.API.Endpoints.Participations;

public static class SearchParticipationsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/participations", async ([AsParameters] SearchParticipationsQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.Member)
        .WithName("SearchParticipations")
        .WithTags("Participations")
        .Produces<PagedResponse<ParticipationSummaryDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
