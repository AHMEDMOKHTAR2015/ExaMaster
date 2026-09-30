using QuizMaster.Application.Features.Academic.DeleteTeacher;

namespace QuizMaster.API.Endpoints.Academic;

public static class DeleteTeacherEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/teachers/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new DeleteTeacherCommand { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("DeleteTeacher")
        .WithTags("Teachers")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
