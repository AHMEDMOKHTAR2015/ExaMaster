using QuizMaster.Application.Features.TeachingRooms.RejectTeachingRoomMember;
using QuizMaster.Domain.TeachingRooms;

namespace QuizMaster.API.Endpoints.TeachingRooms;

public static class RejectTeachingRoomMemberEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        // turns a waiting student away, or removes an admitted one
        app.MapPost("/teaching-rooms/{id:int}/members/{studentId:int}:reject", async (int id, int studentId, ISender sender) =>
            Results.Ok(await sender.Send(new RejectTeachingRoomMemberCommand(studentId) { AggregateId = id })))
        .RequireRoleAuthorization<TeachingRoom>(Role.Teacher)
        .WithName("RejectTeachingRoomMember")
        .WithTags("Teaching rooms")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
