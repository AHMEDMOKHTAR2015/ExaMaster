namespace QuizMaster.Application.Features.Academic.DeleteClass;

public class DeleteClassCommandHandler(Repository<ClassGroup> _classGroupRepository)
    : IRequestHandler<DeleteClassCommand, IdResponse>
{
    public async Task<IdResponse> Handle(DeleteClassCommand command, CancellationToken ct)
    {
        var classGroup = await _classGroupRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        _classGroupRepository.Remove(classGroup);
        await _classGroupRepository.SaveChangesAsync(ct);

        return new IdResponse(classGroup.Id);
    }
}
