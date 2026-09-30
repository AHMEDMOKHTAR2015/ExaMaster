namespace QuizMaster.Application.Features.Academic.CreateClass;

public class CreateClassCommandHandler(Repository<ClassGroup> _classGroupRepository, Repository<Grade> _gradeRepository, Repository<Teacher> _teacherRepository, Repository<Subject> _subjectRepository)
    : IRequestHandler<CreateClassCommand, IdResponse>
{
    public async Task<IdResponse> Handle(CreateClassCommand command, CancellationToken ct)
    {
        var grade = await _gradeRepository.LoadOrThrowAsync(command.GradeId, ct);
        var teachers = await _teacherRepository.LoadAllOrThrowAsync(command.TeacherIds, ct);
        var subjects = await _subjectRepository.LoadAllOrThrowAsync(command.SubjectIds, ct);

        var classGroup = ClassGroup.Create(grade, command.Name, teachers, subjects, command);

        await _classGroupRepository.AddAsync(classGroup, ct);
        await _classGroupRepository.SaveChangesAsync(ct);

        return new IdResponse(classGroup.Id);
    }
}
