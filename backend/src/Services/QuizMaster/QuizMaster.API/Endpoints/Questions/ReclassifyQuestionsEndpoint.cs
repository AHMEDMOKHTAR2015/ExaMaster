using QuizMaster.Application.Features.Questions.ReclassifyQuestions;

namespace QuizMaster.API.Endpoints.Questions;

public static class ReclassifyQuestionsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/questions:reclassify", async (ReclassifyQuestionsCommand command, ISender sender) => Results.Ok(await sender.Send(command)))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("ReclassifyQuestions")
        .WithTags("Questions")
        .Produces<ReclassifyQuestionsResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
