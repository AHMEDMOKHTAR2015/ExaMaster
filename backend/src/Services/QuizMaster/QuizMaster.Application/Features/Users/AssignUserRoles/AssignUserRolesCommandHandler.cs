namespace QuizMaster.Application.Features.Users.AssignUserRoles;

public class AssignUserRolesCommandHandler(Repository<User> _userRepository)
    : IRequestHandler<AssignUserRolesCommand, IdResponse>
{
    public async Task<IdResponse> Handle(AssignUserRolesCommand command, CancellationToken ct)
    {
        var user = await _userRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        user.AssignRoles(command.Roles, command);

        await _userRepository.SaveChangesAsync(ct);

        return new IdResponse(user.Id);
    }
}
