using QuizMaster.Application.Features.Questions.SearchQuestions;

namespace QuizMaster.API.Endpoints.Questions;

public static class SearchQuestionsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/questions", async ([AsParameters] SearchQuestionsQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.Staff)   // a teacher adds bank questions to their own quizzes
        .WithName("SearchQuestions")
        .WithTags("Question bank")
        .Produces<PagedResponse<QuestionDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
