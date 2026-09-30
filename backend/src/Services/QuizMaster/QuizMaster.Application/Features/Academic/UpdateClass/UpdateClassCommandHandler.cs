namespace QuizMaster.Application.Features.Academic.UpdateClass;

public class UpdateClassCommandHandler(Repository<ClassGroup> _classGroupRepository, Repository<Grade> _gradeRepository, Repository<Teacher> _teacherRepository, Repository<Subject> _subjectRepository)
    : IRequestHandler<UpdateClassCommand, IdResponse>
{
    public async Task<IdResponse> Handle(UpdateClassCommand command, CancellationToken ct)
    {
        var classGroup = await _classGroupRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        var grade = await _gradeRepository.LoadOrThrowAsync(command.GradeId, ct);
        var teachers = await _teacherRepository.LoadAllOrThrowAsync(command.TeacherIds, ct);
        var subjects = await _subjectRepository.LoadAllOrThrowAsync(command.SubjectIds, ct);

        classGroup.Update(grade, command.Name, teachers, subjects, command);

        await _classGroupRepository.SaveChangesAsync(ct);

        return new IdResponse(classGroup.Id);
    }
}
