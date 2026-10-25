using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.Academic.CreateTeacher;

public class CreateTeacherCommandHandler(Repository<Subject> _subjectRepository, TeacherLogin _teacherLogin)
    : IRequestHandler<CreateTeacherCommand, CreateTeacherResponse>
{
    public async Task<CreateTeacherResponse> Handle(CreateTeacherCommand command, CancellationToken ct)
    {
        var subjects = await _subjectRepository.LoadAllOrThrowAsync(command.SubjectIds, ct);

        var teacher = Teacher.Create(command.FirstName, command.LastName, command.Email, command.PhotoUrl, subjects, command);

        // a teacher with an email is only added once their sign-in exists (or their school account is linked)
        var login = await _teacherLogin.SaveWithLoginAsync(teacher, command.Password, command, ct);
        if (login.Status == TeacherLoginStatus.ExistsUnmanaged)
            throw new ConflictException(TeacherLogin.UnmanagedEmailMessage(teacher));

        return new CreateTeacherResponse(teacher.Id, login.Status, login.UserId);
    }
}
