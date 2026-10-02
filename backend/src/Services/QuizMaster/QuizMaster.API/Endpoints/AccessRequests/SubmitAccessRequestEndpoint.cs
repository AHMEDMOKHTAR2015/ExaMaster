using QuizMaster.Application.Features.AccessRequests.SubmitAccessRequest;

namespace QuizMaster.API.Endpoints.AccessRequests;

public static class SubmitAccessRequestEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        // Anonymous: a visitor with no account and no registration key. Rate-limited per address, since anyone can call it.
        app.MapPost("/access-requests", async (SubmitAccessRequestCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/platform/access-requests/{response.Id}", response);
        })
        .AllowAnonymous()
        .RequireRateLimiting(RateLimits.AccessRequest)
        .WithName("SubmitAccessRequest")
        .WithTags("AccessRequests")
        .Produces<IdResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status429TooManyRequests);
    }
}
