using QuizMaster.Application.Features.Academic.DeleteSubject;

namespace QuizMaster.API.Endpoints.Academic;

public static class DeleteSubjectEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/subjects/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new DeleteSubjectCommand { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("DeleteSubject")
        .WithTags("Subjects")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
