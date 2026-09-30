using QuizMaster.Application.Features.Quizzes.ListBankQuizzes;

namespace QuizMaster.API.Endpoints.Quizzes;

public static class ListBankQuizzesEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/quizzes", async ([AsParameters] ListBankQuizzesQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.Member)
        .WithName("ListBankQuizzes")
        .WithTags("Bank quizzes")
        .Produces<ListBankQuizzesResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
