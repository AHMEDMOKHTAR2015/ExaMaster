using QuizMaster.Application.Features.Questions.CreateQuestions;

namespace QuizMaster.API.Endpoints.Questions;

public static class CreateQuestionsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/questions/bulk", async (CreateQuestionsCommand command, ISender sender) => Results.Ok(await sender.Send(command)))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("CreateQuestions")
        .WithTags("Questions")
        .Produces<CreateQuestionsResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
