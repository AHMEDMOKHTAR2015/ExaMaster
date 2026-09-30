namespace QuizMaster.Application.Features.Academic.DeleteTeacher;

public class DeleteTeacherCommandHandler(Repository<Teacher> _teacherRepository, Repository<ClassGroup> _classRepository)
    : IRequestHandler<DeleteTeacherCommand, IdResponse>
{
    public async Task<IdResponse> Handle(DeleteTeacherCommand command, CancellationToken ct)
    {
        var teacher = await _teacherRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        // the classes they taught are left unassigned, in the same commit (a signed-in teacher's link is SET NULL)
        foreach (var classGroup in await _classRepository.Query().Where(e => e.TeacherIds.Contains(teacher.Id)).ToListAsync(ct))
            classGroup.Unassign(teacher, command);

        _teacherRepository.Remove(teacher);
        await _teacherRepository.SaveChangesAsync(ct);

        return new IdResponse(teacher.Id);
    }
}
