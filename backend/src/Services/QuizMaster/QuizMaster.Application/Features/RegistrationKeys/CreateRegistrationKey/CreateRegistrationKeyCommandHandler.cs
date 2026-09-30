namespace QuizMaster.Application.Features.RegistrationKeys.CreateRegistrationKey;

public class CreateRegistrationKeyCommandHandler(Repository<RegistrationKey> _keyRepository)
    : IRequestHandler<CreateRegistrationKeyCommand, RegistrationKeyDto>
{
    public async Task<RegistrationKeyDto> Handle(CreateRegistrationKeyCommand command, CancellationToken ct)
    {
        var key = RegistrationKey.Create(command.Role, command.ExpiresOn, command.MaxChildren, command);

        await _keyRepository.AddAsync(key, ct);
        await _keyRepository.SaveChangesAsync(ct);

        return RegistrationKeyDto.From(key, command.CreatedOn);
    }
}
