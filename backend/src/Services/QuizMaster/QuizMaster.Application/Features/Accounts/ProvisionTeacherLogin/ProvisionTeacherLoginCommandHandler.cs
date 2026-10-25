using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.Accounts.ProvisionTeacherLogin;

public class ProvisionTeacherLoginCommandHandler(Repository<Teacher> _teacherRepository, TeacherLogin _teacherLogin)
    : IRequestHandler<ProvisionTeacherLoginCommand, TeacherLoginResponse>
{
    public async Task<TeacherLoginResponse> Handle(ProvisionTeacherLoginCommand command, CancellationToken ct)
    {
        var teacher = Guard.NotFound(await _teacherRepository.GetByIdAsync(command.AggregateId, ct));
        return await _teacherLogin.SaveWithLoginAsync(teacher, command.Password, command, ct);
    }
}
