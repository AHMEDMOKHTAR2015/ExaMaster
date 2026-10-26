using QuizMaster.Application.Features.TeachingRooms.GetTeachingRoomState;
using QuizMaster.Domain.TeachingRooms;

namespace QuizMaster.API.Endpoints.TeachingRooms;

public static class GetTeachingRoomStateEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        // the board: the presenting teacher and approved students only (the handler refuses everyone else)
        app.MapGet("/teaching-rooms/{id:int}/state", async (int id, ISender sender) => Results.Ok(await sender.Send(new GetTeachingRoomStateQuery(id))))
        .RequireRoleAuthorization<TeachingRoom>(Role.Teacher, Role.Student)
        .WithName("GetTeachingRoomState")
        .WithTags("Teaching rooms")
        .Produces<GetTeachingRoomStateResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
