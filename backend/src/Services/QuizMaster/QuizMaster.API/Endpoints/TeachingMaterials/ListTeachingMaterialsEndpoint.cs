using QuizMaster.Application.Features.TeachingMaterials.ListTeachingMaterials;

namespace QuizMaster.API.Endpoints.TeachingMaterials;

public static class ListTeachingMaterialsEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/teaching-materials", async ([AsParameters] ListTeachingMaterialsQuery query, ISender sender) => Results.Ok(await sender.Send(query)))
        .RequireRoleAuthorization(Role.Staff)
        .WithName("ListTeachingMaterials")
        .WithTags("Teaching materials")
        .Produces<ListTeachingMaterialsResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
