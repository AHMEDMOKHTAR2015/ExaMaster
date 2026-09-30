using QuizMaster.Application.Features.TeacherQuizzes.CreateTeacherQuiz;

namespace QuizMaster.API.Endpoints.TeacherQuizzes;

public static class CreateTeacherQuizEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/teacher-quizzes", async (CreateTeacherQuizCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/teacher-quizzes/{response.Id}", response);
        })
        .RequireRoleAuthorization(Role.Teacher, Role.ApplicationAdmin)
        .WithName("CreateTeacherQuiz")
        .WithTags("Teacher quizzes")
        .Produces<IdResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
