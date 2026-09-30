using QuizMaster.Application.Features.Quizzes.GetBankQuizSitting;

namespace QuizMaster.API.Endpoints.Quizzes;

public static class GetBankQuizSittingEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/quizzes/{id:int}/sitting", async (int id, ISender sender) => Results.Ok(await sender.Send(new GetBankQuizSittingQuery(id))))
        .RequireRoleAuthorization(Role.Member)
        .WithName("GetBankQuizSitting")
        .WithTags("Bank quizzes")
        .Produces<SittingDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
