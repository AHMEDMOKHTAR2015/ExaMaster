namespace QuizMaster.Application.Features.RegistrationKeys.DeleteRegistrationKey;

public class DeleteRegistrationKeyCommandHandler(Repository<RegistrationKey> _keyRepository)
    : IRequestHandler<DeleteRegistrationKeyCommand, IdResponse>
{
    public async Task<IdResponse> Handle(DeleteRegistrationKeyCommand command, CancellationToken ct)
    {
        var key = await _keyRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        _keyRepository.Remove(key);
        await _keyRepository.SaveChangesAsync(ct);             // a key still held by an account is a foreign-key conflict

        return new IdResponse(key.Id);
    }
}
