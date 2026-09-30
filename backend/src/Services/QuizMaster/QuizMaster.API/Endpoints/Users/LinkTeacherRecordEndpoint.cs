using QuizMaster.Application.Features.Users.LinkTeacherRecord;

namespace QuizMaster.API.Endpoints.Users;

public static class LinkTeacherRecordEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPut("/users/{id:int}/teacher-record", async (int id, LinkTeacherRecordCommand command, ISender sender) => Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization(Role.ApplicationAdmin)
        .WithName("LinkTeacherRecord")
        .WithTags("Users")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
