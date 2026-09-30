using QuizMaster.Application.Features.Questions.UpdateQuestion;

namespace QuizMaster.API.Endpoints.Questions;

public static class UpdateQuestionEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/questions/{id:int}", async (int id, UpdateQuestionCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("UpdateQuestion")
        .WithTags("Question bank")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
