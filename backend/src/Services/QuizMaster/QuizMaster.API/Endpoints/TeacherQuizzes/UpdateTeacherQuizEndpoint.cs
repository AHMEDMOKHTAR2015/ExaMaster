using QuizMaster.Application.Features.TeacherQuizzes.UpdateTeacherQuiz;
using QuizMaster.Domain.TeacherQuizzes;

namespace QuizMaster.API.Endpoints.TeacherQuizzes;

public static class UpdateTeacherQuizEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/teacher-quizzes/{id:int}", async (int id, UpdateTeacherQuizCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization<TeacherQuiz>(Role.Teacher, Role.ApplicationAdmin)
        .WithName("UpdateTeacherQuiz")
        .WithTags("Teacher quizzes")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
