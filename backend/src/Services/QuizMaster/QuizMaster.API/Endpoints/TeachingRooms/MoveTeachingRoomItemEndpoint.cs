using QuizMaster.Application.Features.TeachingRooms.MoveTeachingRoomItem;
using QuizMaster.Domain.TeachingRooms;

namespace QuizMaster.API.Endpoints.TeachingRooms;

public static class MoveTeachingRoomItemEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        MapMove(app, "next", TeachingRoomMove.Next, "MoveTeachingRoomToNextItem");
        MapMove(app, "previous", TeachingRoomMove.Previous, "MoveTeachingRoomToPreviousItem");
    }

    // the presenting teacher only (access checker + aggregate); past either end is a 400 and nothing moves
    private static void MapMove(IEndpointRouteBuilder app, string verb, TeachingRoomMove move, string name)
        => app.MapPost($"/teaching-rooms/{{id:int}}:{verb}", async (int id, ISender sender) =>
            Results.Ok(await sender.Send(new MoveTeachingRoomItemCommand(move) { AggregateId = id })))
        .RequireRoleAuthorization<TeachingRoom>(Role.Teacher)
        .WithName(name)
        .WithTags("Teaching rooms")
        .Produces<MoveTeachingRoomItemResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
}
