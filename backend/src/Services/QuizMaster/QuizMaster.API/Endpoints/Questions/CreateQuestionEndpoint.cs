using QuizMaster.Application.Features.Questions.CreateQuestion;

namespace QuizMaster.API.Endpoints.Questions;

public static class CreateQuestionEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/questions", async (CreateQuestionCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/questions/{response.Id}", response);
        })
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("CreateQuestion")
        .WithTags("Question bank")
        .Produces<IdResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
