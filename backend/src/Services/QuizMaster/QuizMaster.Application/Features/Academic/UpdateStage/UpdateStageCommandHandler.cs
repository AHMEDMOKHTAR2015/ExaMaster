namespace QuizMaster.Application.Features.Academic.UpdateStage;

public class UpdateStageCommandHandler(Repository<Stage> _stageRepository)
    : IRequestHandler<UpdateStageCommand, IdResponse>
{
    public async Task<IdResponse> Handle(UpdateStageCommand command, CancellationToken ct)
    {
        var stage = await _stageRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        stage.Update(command.Name, command.Order, command);

        await _stageRepository.SaveChangesAsync(ct);

        return new IdResponse(stage.Id);
    }
}
