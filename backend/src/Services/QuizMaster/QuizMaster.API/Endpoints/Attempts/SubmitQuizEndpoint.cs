using QuizMaster.Application.Features.Attempts.SubmitQuiz;

namespace QuizMaster.API.Endpoints.Attempts;

public static class SubmitQuizEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/submissions", async (SubmitQuizCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/participations/{response.ParticipationId}", response);
        })
        .RequireRoleAuthorization(Role.Member)
        .WithName("SubmitQuiz")
        .WithTags("Sitting a quiz")
        .Produces<SubmitQuizResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
