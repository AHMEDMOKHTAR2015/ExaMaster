using QuizMaster.Application.Features.Academic.CreateTeacher;

namespace QuizMaster.API.Endpoints.Academic;

public static class CreateTeacherEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/teachers", async (CreateTeacherCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/teachers/{response.Id}", response);
        })
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("CreateTeacher")
        .WithTags("Teachers")
        .Produces<IdResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
