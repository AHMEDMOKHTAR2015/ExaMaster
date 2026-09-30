using QuizMaster.Application.Features.Academic.CreateSubject;

namespace QuizMaster.API.Endpoints.Academic;

public static class CreateSubjectEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/subjects", async (CreateSubjectCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/subjects/{response.Id}", response);
        })
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("CreateSubject")
        .WithTags("Subjects")
        .Produces<IdResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
