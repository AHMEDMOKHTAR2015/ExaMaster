namespace QuizMaster.Application.Features.Academic.DeleteSubject;

public class DeleteSubjectCommandHandler(
    SubjectRepository _subjectRepository, Repository<ClassGroup> _classRepository, Repository<Teacher> _teacherRepository, Repository<Question> _questionRepository)
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
        // its bank questions lose their subject (QuizMasterDbContext) and so its tags, which are deleted with it
        var tagIds = subject.Tags.Select(tag => tag.Id).ToList();
        foreach (var question in await _questionRepository.Query().Where(e => e.SubjectId == subject.Id && e.TagIds.Any()).ToListAsync(ct))
            question.Untag(tagIds, command);

        _subjectRepository.Remove(subject);
        await _subjectRepository.SaveChangesAsync(ct);

        return new IdResponse(subject.Id);
    }
}
