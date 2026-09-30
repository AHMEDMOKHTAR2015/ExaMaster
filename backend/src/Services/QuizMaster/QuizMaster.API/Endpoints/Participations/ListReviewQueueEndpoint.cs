using QuizMaster.Application.Features.Participations.ListReviewQueue;

namespace QuizMaster.API.Endpoints.Participations;

public static class ListReviewQueueEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/reviews", async ([AsParameters] ListReviewQueueQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.Staff)
        .WithName("ListReviewQueue")
        .WithTags("Participations")
        .Produces<PagedResponse<ParticipationSummaryDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
