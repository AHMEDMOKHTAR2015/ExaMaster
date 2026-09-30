using QuizMaster.Application.Features.Quizzes.CreateBankQuiz;

namespace QuizMaster.API.Endpoints.Quizzes;

public static class CreateBankQuizEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/quizzes", async (CreateBankQuizCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/quizzes/{response.Id}", response);
        })
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("CreateBankQuiz")
        .WithTags("Bank quizzes")
        .Produces<IdResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
