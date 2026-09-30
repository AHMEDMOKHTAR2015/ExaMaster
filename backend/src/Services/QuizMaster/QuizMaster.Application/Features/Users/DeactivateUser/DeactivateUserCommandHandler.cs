namespace QuizMaster.Application.Features.Users.DeactivateUser;

public class DeactivateUserCommandHandler(Repository<User> _userRepository)
    : IRequestHandler<DeactivateUserCommand, IdResponse>
{
    public async Task<IdResponse> Handle(DeactivateUserCommand command, CancellationToken ct)
    {
        var user = await _userRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        user.Deactivate(command);

        await _userRepository.SaveChangesAsync(ct);

        return new IdResponse(user.Id);
    }
}
