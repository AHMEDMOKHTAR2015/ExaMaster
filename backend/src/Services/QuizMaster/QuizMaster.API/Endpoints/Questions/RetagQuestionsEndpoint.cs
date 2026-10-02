using QuizMaster.Application.Features.Questions.RetagQuestions;

namespace QuizMaster.API.Endpoints.Questions;

public static class RetagQuestionsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/questions:retag", async (RetagQuestionsCommand command, ISender sender) => Results.Ok(await sender.Send(command)))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("RetagQuestions")
        .WithTags("Questions")
        .Produces<RetagQuestionsResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
