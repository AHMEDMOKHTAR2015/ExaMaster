using QuizMaster.Application.Features.Quizzes.GetBankQuiz;

namespace QuizMaster.API.Endpoints.Quizzes;

public static class GetBankQuizEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/quizzes/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new GetBankQuizQuery(id))))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("GetBankQuiz")
        .WithTags("Bank quizzes")
        .Produces<GetBankQuizResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
