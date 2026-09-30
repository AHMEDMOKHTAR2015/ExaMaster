namespace QuizMaster.Application.Features.Academic.UpdateTeacher;

public class UpdateTeacherCommandHandler(Repository<Teacher> _teacherRepository, Repository<Subject> _subjectRepository)
    : IRequestHandler<UpdateTeacherCommand, IdResponse>
{
    public async Task<IdResponse> Handle(UpdateTeacherCommand command, CancellationToken ct)
    {
        var teacher = await _teacherRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        var subjects = await _subjectRepository.LoadAllOrThrowAsync(command.SubjectIds, ct);

        teacher.Update(command.FirstName, command.LastName, command.Email, command.PhotoUrl, subjects, command);

        await _teacherRepository.SaveChangesAsync(ct);

        return new IdResponse(teacher.Id);
    }
}
