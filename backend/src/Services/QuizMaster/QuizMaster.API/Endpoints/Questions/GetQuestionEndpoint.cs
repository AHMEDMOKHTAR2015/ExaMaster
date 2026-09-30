using QuizMaster.Application.Features.Questions.GetQuestion;

namespace QuizMaster.API.Endpoints.Questions;

public static class GetQuestionEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/questions/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new GetQuestionQuery(id))))
        .RequireRoleAuthorization(Role.Staff)
        .WithName("GetQuestion")
        .WithTags("Question bank")
        .Produces<GetQuestionResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
