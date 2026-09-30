using QuizMaster.Application.Features.TeacherQuizzes.DeleteTeacherQuiz;
using QuizMaster.Domain.TeacherQuizzes;

namespace QuizMaster.API.Endpoints.TeacherQuizzes;

public static class DeleteTeacherQuizEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/teacher-quizzes/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new DeleteTeacherQuizCommand { AggregateId = id })))
        .RequireRoleAuthorization<TeacherQuiz>(Role.Teacher, Role.ApplicationAdmin)
        .WithName("DeleteTeacherQuiz")
        .WithTags("Teacher quizzes")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
