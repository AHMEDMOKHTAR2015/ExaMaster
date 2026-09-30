using QuizMaster.Application.Features.TeacherQuizzes.GetTeacherQuiz;

namespace QuizMaster.API.Endpoints.TeacherQuizzes;

public static class GetTeacherQuizEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/teacher-quizzes/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new GetTeacherQuizQuery(id))))
        .RequireRoleAuthorization(Role.Staff)
        .WithName("GetTeacherQuiz")
        .WithTags("Teacher quizzes")
        .Produces<GetTeacherQuizResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
