using QuizMaster.Application.Features.TeachingMaterials.GetTeachingMaterial;
using QuizMaster.Domain.TeachingMaterials;

namespace QuizMaster.API.Endpoints.TeachingMaterials;

public static class GetTeachingMaterialEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapGet("/teaching-materials/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new GetTeachingMaterialQuery(id))))
        .RequireRoleAuthorization<TeachingMaterial>(Role.Teacher, Role.ApplicationAdmin)
        .WithName("GetTeachingMaterial")
        .WithTags("Teaching materials")
        .Produces<GetTeachingMaterialResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
