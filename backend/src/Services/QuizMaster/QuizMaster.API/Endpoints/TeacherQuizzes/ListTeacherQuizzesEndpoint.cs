using QuizMaster.Application.Features.TeacherQuizzes.ListTeacherQuizzes;

namespace QuizMaster.API.Endpoints.TeacherQuizzes;

public static class ListTeacherQuizzesEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/teacher-quizzes", async ([AsParameters] ListTeacherQuizzesQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.Staff)
        .WithName("ListTeacherQuizzes")
        .WithTags("Teacher quizzes")
        .Produces<ListTeacherQuizzesResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
