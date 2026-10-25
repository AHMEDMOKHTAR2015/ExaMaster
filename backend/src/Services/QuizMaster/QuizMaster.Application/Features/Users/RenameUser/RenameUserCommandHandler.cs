namespace QuizMaster.Application.Features.Users.RenameUser;

public class RenameUserCommandHandler(Repository<User> _userRepository, Repository<Teacher> _teacherRepository)
    : IRequestHandler<RenameUserCommand, IdResponse>
{
    public async Task<IdResponse> Handle(RenameUserCommand command, CancellationToken ct)
    {
        var user = await _userRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        user.Rename(command.FirstName, command.LastName, command);

        // a teacher's roster record is the same person: the Teachers list shows the new name too
        if (user.TeacherId is { } teacherId && await _teacherRepository.GetByIdAsync(teacherId, ct) is { } teacher)
            teacher.Rename(user.FirstName!, user.LastName!, command);

        await _userRepository.SaveChangesAsync(ct);

        return new IdResponse(user.Id);
    }
}
