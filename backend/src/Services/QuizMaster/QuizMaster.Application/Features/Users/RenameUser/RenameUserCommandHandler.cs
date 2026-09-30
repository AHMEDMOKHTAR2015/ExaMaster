namespace QuizMaster.Application.Features.Users.RenameUser;

public class RenameUserCommandHandler(Repository<User> _userRepository) : IRequestHandler<RenameUserCommand, IdResponse>
{
    public async Task<IdResponse> Handle(RenameUserCommand command, CancellationToken ct)
    {
        var user = await _userRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        user.Rename(command.FirstName, command.LastName, command);
        await _userRepository.SaveChangesAsync(ct);

        return new IdResponse(user.Id);
    }
}
