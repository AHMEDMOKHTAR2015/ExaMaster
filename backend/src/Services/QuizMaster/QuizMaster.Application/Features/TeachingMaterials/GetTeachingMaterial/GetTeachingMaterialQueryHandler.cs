namespace QuizMaster.Application.Features.TeachingMaterials.GetTeachingMaterial;

public class GetTeachingMaterialQueryHandler(TeachingMaterialRepository _teachingMaterialRepository)
    : IRequestHandler<GetTeachingMaterialQuery, GetTeachingMaterialResponse>
{
    public async Task<GetTeachingMaterialResponse> Handle(GetTeachingMaterialQuery query, CancellationToken ct)
    {
        var material = Guard.NotFound(await _teachingMaterialRepository.GetByIdAsync(query.Id, ct));

        return new GetTeachingMaterialResponse(material.Adapt<TeachingMaterialDto>());
    }
}
