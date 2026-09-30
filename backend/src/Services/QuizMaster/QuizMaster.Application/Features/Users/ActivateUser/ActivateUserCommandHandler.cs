namespace QuizMaster.Application.Features.Users.ActivateUser;

public class ActivateUserCommandHandler(Repository<User> _userRepository)
    : IRequestHandler<ActivateUserCommand, IdResponse>
{
    public async Task<IdResponse> Handle(ActivateUserCommand command, CancellationToken ct)
    {
        var user = await _userRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        user.Activate(command);

        await _userRepository.SaveChangesAsync(ct);

        return new IdResponse(user.Id);
    }
}
