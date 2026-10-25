namespace QuizMaster.Application.Features.TeachingMaterials.DeleteTeachingMaterial;

public class DeleteTeachingMaterialCommandHandler(TeachingMaterialRepository _teachingMaterialRepository)
    : IRequestHandler<DeleteTeachingMaterialCommand, IdResponse>
{
    public async Task<IdResponse> Handle(DeleteTeachingMaterialCommand command, CancellationToken ct)
    {
        var material = await _teachingMaterialRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        _teachingMaterialRepository.Remove(material);
        await _teachingMaterialRepository.SaveChangesAsync(ct);

        return new IdResponse(material.Id);
    }
}
