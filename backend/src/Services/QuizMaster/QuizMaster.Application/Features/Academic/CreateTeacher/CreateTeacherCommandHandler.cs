namespace QuizMaster.Application.Features.Academic.CreateTeacher;

public class CreateTeacherCommandHandler(Repository<Teacher> _teacherRepository, Repository<Subject> _subjectRepository)
    : IRequestHandler<CreateTeacherCommand, IdResponse>
{
    public async Task<IdResponse> Handle(CreateTeacherCommand command, CancellationToken ct)
    {
        var subjects = await _subjectRepository.LoadAllOrThrowAsync(command.SubjectIds, ct);

        var teacher = Teacher.Create(command.FirstName, command.LastName, command.Email, command.PhotoUrl, subjects, command);

        await _teacherRepository.AddAsync(teacher, ct);
        await _teacherRepository.SaveChangesAsync(ct);

        return new IdResponse(teacher.Id);
    }
}
