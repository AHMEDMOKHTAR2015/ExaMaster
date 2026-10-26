using QuizMaster.Application.Features.TeachingRooms.ApproveTeachingRoomMember;
using QuizMaster.Domain.TeachingRooms;

namespace QuizMaster.API.Endpoints.TeachingRooms;

public static class ApproveTeachingRoomMemberEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/teaching-rooms/{id:int}/members/{studentId:int}:approve", async (int id, int studentId, ISender sender) =>
            Results.Ok(await sender.Send(new ApproveTeachingRoomMemberCommand(studentId) { AggregateId = id })))
        .RequireRoleAuthorization<TeachingRoom>(Role.Teacher)
        .WithName("ApproveTeachingRoomMember")
        .WithTags("Teaching rooms")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
