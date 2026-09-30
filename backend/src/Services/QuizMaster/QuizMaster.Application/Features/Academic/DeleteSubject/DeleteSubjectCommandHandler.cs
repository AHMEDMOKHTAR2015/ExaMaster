namespace QuizMaster.Application.Features.Academic.DeleteSubject;

public class DeleteSubjectCommandHandler(Repository<Subject> _subjectRepository, Repository<ClassGroup> _classRepository, Repository<Teacher> _teacherRepository)
    : IRequestHandler<DeleteSubjectCommand, IdResponse>
{
    public async Task<IdResponse> Handle(DeleteSubjectCommand command, CancellationToken ct)
    {
        var subject = await _subjectRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        // classes and teachers drop it in the same commit; a teacher quiz still written in it refuses the delete (409)
        foreach (var classGroup in await _classRepository.Query().Where(e => e.SubjectIds.Contains(subject.Id)).ToListAsync(ct))
            classGroup.Drop(subject, command);
        foreach (var teacher in await _teacherRepository.Query().Where(e => e.SubjectIds.Contains(subject.Id)).ToListAsync(ct))
            teacher.Drop(subject, command);

        _subjectRepository.Remove(subject);
        await _subjectRepository.SaveChangesAsync(ct);

        return new IdResponse(subject.Id);
    }
}
