using QuizMaster.Application.Features.Academic.ListStages;

namespace QuizMaster.API.Endpoints.Academic;

public static class ListStagesEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/stages", async ([AsParameters] ListStagesQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.Member)
        .WithName("ListStages")
        .WithTags("Stages")
        .Produces<ListStagesResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
