using QuizMaster.Application.Features.TeacherQuizzes.GetTeacherQuizSitting;

namespace QuizMaster.API.Endpoints.TeacherQuizzes;

public static class GetTeacherQuizSittingEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/teacher-quizzes/{id:int}/sitting", async (int id, ISender sender) => Results.Ok(await sender.Send(new GetTeacherQuizSittingQuery(id))))
        .RequireRoleAuthorization(Role.Member)
        .WithName("GetTeacherQuizSitting")
        .WithTags("Teacher quizzes")
        .Produces<SittingDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
