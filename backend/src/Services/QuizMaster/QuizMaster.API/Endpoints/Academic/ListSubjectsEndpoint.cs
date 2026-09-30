using QuizMaster.Application.Features.Academic.ListSubjects;

namespace QuizMaster.API.Endpoints.Academic;

public static class ListSubjectsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/subjects", async ([AsParameters] ListSubjectsQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.Member)
        .WithName("ListSubjects")
        .WithTags("Subjects")
        .Produces<ListSubjectsResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
