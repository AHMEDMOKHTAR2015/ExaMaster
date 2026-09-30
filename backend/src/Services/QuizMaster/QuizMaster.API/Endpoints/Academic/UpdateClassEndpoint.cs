using QuizMaster.Application.Features.Academic.UpdateClass;

namespace QuizMaster.API.Endpoints.Academic;

public static class UpdateClassEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/classes/{id:int}", async (int id, UpdateClassCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("UpdateClass")
        .WithTags("Classes")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
