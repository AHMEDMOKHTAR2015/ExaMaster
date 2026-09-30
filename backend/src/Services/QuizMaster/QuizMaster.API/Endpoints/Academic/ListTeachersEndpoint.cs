using QuizMaster.Application.Features.Academic.ListTeachers;

namespace QuizMaster.API.Endpoints.Academic;

public static class ListTeachersEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/teachers", async ([AsParameters] ListTeachersQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.Member)
        .WithName("ListTeachers")
        .WithTags("Teachers")
        .Produces<ListTeachersResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
