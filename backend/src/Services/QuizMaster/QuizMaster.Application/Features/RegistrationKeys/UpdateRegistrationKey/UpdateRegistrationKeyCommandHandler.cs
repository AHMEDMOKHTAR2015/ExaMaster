namespace QuizMaster.Application.Features.RegistrationKeys.UpdateRegistrationKey;

public class UpdateRegistrationKeyCommandHandler(Repository<RegistrationKey> _keyRepository)
    : IRequestHandler<UpdateRegistrationKeyCommand, IdResponse>
{
    public async Task<IdResponse> Handle(UpdateRegistrationKeyCommand command, CancellationToken ct)
    {
        var key = await _keyRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        key.UpdateTerms(command.ExpiresOn, command.MaxChildren, command);
        if (command.IsActive)
            key.Activate(command);
        else
            key.Deactivate(command);

        await _keyRepository.SaveChangesAsync(ct);
        return new IdResponse(key.Id);
    }
}
