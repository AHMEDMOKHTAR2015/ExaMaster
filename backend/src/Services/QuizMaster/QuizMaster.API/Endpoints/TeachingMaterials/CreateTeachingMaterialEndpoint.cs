using QuizMaster.Application.Features.TeachingMaterials.CreateTeachingMaterial;

namespace QuizMaster.API.Endpoints.TeachingMaterials;

public static class CreateTeachingMaterialEndpoint
{
    public static void Map(this IEndpointRouteBuilder app)
    {
        // teachers only: material is uploaded for a subject on the uploader's own roster record
        app.MapPost("/teaching-materials", async (CreateTeachingMaterialCommand command, ISender sender) =>
        {
            var response = await sender.Send(command);
            return Results.Created($"/api/teaching-materials/{response.Id}", response);
        })
        .RequireRoleAuthorization(Role.Teacher)
        .WithName("CreateTeachingMaterial")
        .WithTags("Teaching materials")
        .Produces<IdResponse>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);
    }
}
