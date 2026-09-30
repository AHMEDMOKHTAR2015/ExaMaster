using QuizMaster.Application.Features.Quizzes.DeleteBankQuiz;

namespace QuizMaster.API.Endpoints.Quizzes;

public static class DeleteBankQuizEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/quizzes/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new DeleteBankQuizCommand { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("DeleteBankQuiz")
        .WithTags("Bank quizzes")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
