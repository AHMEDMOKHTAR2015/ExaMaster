using QuizMaster.Application.Features.Academic.UpdateSubject;

namespace QuizMaster.API.Endpoints.Academic;

public static class UpdateSubjectEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/subjects/{id:int}", async (int id, UpdateSubjectCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("UpdateSubject")
        .WithTags("Subjects")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
