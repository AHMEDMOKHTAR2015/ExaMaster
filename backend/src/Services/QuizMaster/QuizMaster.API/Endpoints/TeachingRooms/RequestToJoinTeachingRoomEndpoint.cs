using QuizMaster.Application.Features.TeachingRooms.RequestToJoinTeachingRoom;
using QuizMaster.Domain.TeachingRooms;

namespace QuizMaster.API.Endpoints.TeachingRooms;

public static class RequestToJoinTeachingRoomEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/teaching-rooms/{id:int}/join-requests", async (int id, ISender sender) =>
            Results.Ok(await sender.Send(new RequestToJoinTeachingRoomCommand { AggregateId = id })))
        .RequireRoleAuthorization<TeachingRoom>(Role.Student)
        .WithName("RequestToJoinTeachingRoom")
        .WithTags("Teaching rooms")
        .Produces<RequestToJoinTeachingRoomResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
