using QuizMaster.Application.Features.Academic.DeleteGrade;

namespace QuizMaster.API.Endpoints.Academic;

public static class DeleteGradeEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/grades/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new DeleteGradeCommand { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("DeleteGrade")
        .WithTags("Grades")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
