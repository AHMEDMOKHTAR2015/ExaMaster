using QuizMaster.Application.Features.TeachingRooms.GetTeachingRoom;
using QuizMaster.Domain.TeachingRooms;

namespace QuizMaster.API.Endpoints.TeachingRooms;

public static class GetTeachingRoomEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/teaching-rooms/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new GetTeachingRoomQuery(id))))
        .RequireRoleAuthorization<TeachingRoom>(Role.Teacher, Role.Student)
        .WithName("GetTeachingRoom")
        .WithTags("Teaching rooms")
        .Produces<GetTeachingRoomResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
