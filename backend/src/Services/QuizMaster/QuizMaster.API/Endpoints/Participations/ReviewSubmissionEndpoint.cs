using QuizMaster.Application.Features.Participations.ReviewSubmission;
using QuizMaster.Domain.Participations;

namespace QuizMaster.API.Endpoints.Participations;

public static class ReviewSubmissionEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/participations/{id:int}:review", async (int id, ReviewSubmissionCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization<Participation>(Role.Staff)
        .WithName("ReviewSubmission")
        .WithTags("Participations")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
