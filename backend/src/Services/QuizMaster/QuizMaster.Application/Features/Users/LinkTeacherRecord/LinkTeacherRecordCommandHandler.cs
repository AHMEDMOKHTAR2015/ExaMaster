namespace QuizMaster.Application.Features.Users.LinkTeacherRecord;

public class LinkTeacherRecordCommandHandler(Repository<User> _userRepository, Repository<Teacher> _teacherRepository)
    : IRequestHandler<LinkTeacherRecordCommand, IdResponse>
{
    public async Task<IdResponse> Handle(LinkTeacherRecordCommand command, CancellationToken ct)
    {
        var user = await _userRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        var teacher = await _teacherRepository.LoadOrThrowAsync(command.TeacherId, ct);

        user.LinkToTeacherRecord(teacher, command);

        await _userRepository.SaveChangesAsync(ct);

        return new IdResponse(user.Id);
    }
}
