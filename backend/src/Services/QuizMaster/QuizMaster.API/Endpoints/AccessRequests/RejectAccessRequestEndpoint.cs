using QuizMaster.Application.Features.AccessRequests.RejectAccessRequest;

namespace QuizMaster.API.Endpoints.AccessRequests;

public static class RejectAccessRequestEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapPost("/platform/access-requests/{id:int}:reject", async (int id, RejectAccessRequestCommand command, ISender sender) =>
            Results.Ok(await sender.Send(command with { AggregateId = id })))
        .RequireRoleAuthorization(Role.PlatformAdmin)
        .WithName("RejectAccessRequest")
        .WithTags("AccessRequests")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
