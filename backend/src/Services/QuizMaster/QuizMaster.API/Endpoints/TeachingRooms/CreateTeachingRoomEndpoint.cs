using QuizMaster.Application.Features.TeachingRooms.CreateTeachingRoom;

namespace QuizMaster.API.Endpoints.TeachingRooms;

public static class CreateTeachingRoomEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        // teachers only: a room presents material its teacher uploaded
        app.MapPost("/teaching-rooms", async (CreateTeachingRoomCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/teaching-rooms/{response.Id}", response);
        })
        .RequireRoleAuthorization(Role.Teacher)
        .WithName("CreateTeachingRoom")
        .WithTags("Teaching rooms")
        .Produces<IdResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
