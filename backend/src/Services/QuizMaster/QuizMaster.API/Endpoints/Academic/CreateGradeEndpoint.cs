using QuizMaster.Application.Features.Academic.CreateGrade;

namespace QuizMaster.API.Endpoints.Academic;

public static class CreateGradeEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/grades", async (CreateGradeCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/grades/{response.Id}", response);
        })
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("CreateGrade")
        .WithTags("Grades")
        .Produces<IdResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
