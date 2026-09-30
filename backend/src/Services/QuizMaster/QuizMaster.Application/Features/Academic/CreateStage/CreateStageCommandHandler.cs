namespace QuizMaster.Application.Features.Academic.CreateStage;

public class CreateStageCommandHandler(Repository<Stage> _stageRepository)
    : IRequestHandler<CreateStageCommand, IdResponse>
{
    public async Task<IdResponse> Handle(CreateStageCommand command, CancellationToken ct)
    {
        var stage = Stage.Create(command.Name, command.Order, command);

        await _stageRepository.AddAsync(stage, ct);
        await _stageRepository.SaveChangesAsync(ct);

        return new IdResponse(stage.Id);
    }
}
