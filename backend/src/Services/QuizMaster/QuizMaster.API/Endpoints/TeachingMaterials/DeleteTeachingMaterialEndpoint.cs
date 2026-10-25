using QuizMaster.Application.Features.TeachingMaterials.DeleteTeachingMaterial;
using QuizMaster.Domain.TeachingMaterials;

namespace QuizMaster.API.Endpoints.TeachingMaterials;

public static class DeleteTeachingMaterialEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/teaching-materials/{id:int}", async (int id, ISender sender) => Results.Ok(await sender.Send(new DeleteTeachingMaterialCommand { AggregateId = id })))
        .RequireRoleAuthorization<TeachingMaterial>(Role.Teacher, Role.ApplicationAdmin)
        .WithName("DeleteTeachingMaterial")
        .WithTags("Teaching materials")
        .Produces<IdResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
