using QuizMaster.Application.Features.Academic.DeleteClass;

namespace QuizMaster.API.Endpoints.Academic;

public static class DeleteClassEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/classes/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new DeleteClassCommand { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("DeleteClass")
        .WithTags("Classes")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
