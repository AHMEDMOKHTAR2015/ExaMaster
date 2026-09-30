using QuizMaster.Application.Features.Academic.UpdateTeacher;

namespace QuizMaster.API.Endpoints.Academic;

public static class UpdateTeacherEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/teachers/{id:int}", async (int id, UpdateTeacherCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("UpdateTeacher")
        .WithTags("Teachers")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
