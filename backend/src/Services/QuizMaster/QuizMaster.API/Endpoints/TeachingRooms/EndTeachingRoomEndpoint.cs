using QuizMaster.Application.Features.TeachingRooms.EndTeachingRoom;
using QuizMaster.Domain.TeachingRooms;

namespace QuizMaster.API.Endpoints.TeachingRooms;

public static class EndTeachingRoomEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/teaching-rooms/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new EndTeachingRoomCommand { AggregateId = id })))
        .RequireRoleAuthorization<TeachingRoom>(Role.Teacher)
        .WithName("EndTeachingRoom")
        .WithTags("Teaching rooms")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
