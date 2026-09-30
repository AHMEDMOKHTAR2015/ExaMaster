using QuizMaster.Application.Features.Academic.CreateStage;

namespace QuizMaster.API.Endpoints.Academic;

public static class CreateStageEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/stages", async (CreateStageCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/stages/{response.Id}", response);
        })
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("CreateStage")
        .WithTags("Stages")
        .Produces<IdResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
