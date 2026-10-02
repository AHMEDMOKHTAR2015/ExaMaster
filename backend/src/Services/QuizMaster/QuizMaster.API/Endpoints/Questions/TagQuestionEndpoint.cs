using QuizMaster.Application.Features.Questions.TagQuestion;

namespace QuizMaster.API.Endpoints.Questions;

public static class TagQuestionEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/questions/{id:int}/tags", async (int id, TagQuestionCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("TagQuestion")
        .WithTags("Question bank")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
