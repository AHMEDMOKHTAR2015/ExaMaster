using QuizMaster.Application.Features.Quizzes.UpdateBankQuiz;

namespace QuizMaster.API.Endpoints.Quizzes;

public static class UpdateBankQuizEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/quizzes/{id:int}", async (int id, UpdateBankQuizCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("UpdateBankQuiz")
        .WithTags("Bank quizzes")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
