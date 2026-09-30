using QuizMaster.Application.Features.Academic.UpdateGrade;

namespace QuizMaster.API.Endpoints.Academic;

public static class UpdateGradeEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/grades/{id:int}", async (int id, UpdateGradeCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("UpdateGrade")
        .WithTags("Grades")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
