using QuizMaster.Application.Features.Academic.CreateClass;

namespace QuizMaster.API.Endpoints.Academic;

public static class CreateClassEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/classes", async (CreateClassCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/classes/{response.Id}", response);
        })
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("CreateClass")
        .WithTags("Classes")
        .Produces<IdResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
