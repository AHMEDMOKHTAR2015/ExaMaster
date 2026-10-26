using QuizMaster.Application.Features.TeachingRooms.ListTeachingRooms;

namespace QuizMaster.API.Endpoints.TeachingRooms;

public static class ListTeachingRoomsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/teaching-rooms", async (ISender sender) => Results.Ok(await sender.Send(new ListTeachingRoomsQuery())))
        .RequireRoleAuthorization(Role.Teacher, Role.Student)
        .WithName("ListTeachingRooms")
        .WithTags("Teaching rooms")
        .Produces<ListTeachingRoomsResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
