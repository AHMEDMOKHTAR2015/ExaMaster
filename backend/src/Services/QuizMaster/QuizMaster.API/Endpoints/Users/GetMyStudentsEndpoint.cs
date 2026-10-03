using QuizMaster.Application.Features.Users.GetMyStudents;

namespace QuizMaster.API.Endpoints.Users;

public static class GetMyStudentsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/me/students", async (ISender sender) => Results.Ok(await sender.Send(new GetMyStudentsQuery())))
        .RequireRoleAuthorization(Role.Teacher)
        .WithName("GetMyStudents")
        .WithTags("Me")
        .Produces<GetMyStudentsResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
