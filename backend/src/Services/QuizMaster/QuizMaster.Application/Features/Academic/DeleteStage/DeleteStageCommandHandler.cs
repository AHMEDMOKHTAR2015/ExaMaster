namespace QuizMaster.Application.Features.Academic.DeleteStage;

public class DeleteStageCommandHandler(Repository<Stage> _stageRepository)
    : IRequestHandler<DeleteStageCommand, IdResponse>
{
    public async Task<IdResponse> Handle(DeleteStageCommand command, CancellationToken ct)
    {
        var stage = await _stageRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        _stageRepository.Remove(stage);
        await _stageRepository.SaveChangesAsync(ct);

        return new IdResponse(stage.Id);
    }
}
