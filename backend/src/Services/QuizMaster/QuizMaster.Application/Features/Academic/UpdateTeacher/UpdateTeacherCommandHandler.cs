using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.Academic.UpdateTeacher;

public class UpdateTeacherCommandHandler(
    Repository<Teacher> _teacherRepository,
    Repository<Subject> _subjectRepository,
    Repository<User> _userRepository,
    TeacherLogin _teacherLogin)
    : IRequestHandler<UpdateTeacherCommand, UpdateTeacherResponse>
{
    public async Task<UpdateTeacherResponse> Handle(UpdateTeacherCommand command, CancellationToken ct)
    {
        var teacher = await _teacherRepository.GetByIdOrThrowAsync(command.AggregateId, ct);
        var subjects = await _subjectRepository.LoadAllOrThrowAsync(command.SubjectIds, ct);

        teacher.Update(command.FirstName, command.LastName, command.Email, command.PhotoUrl, subjects, command);

        // the accounts linked to this record are the same person, so they carry its name (saved with it below)
        var accounts = await _userRepository.Query().Where(user => user.TeacherId == teacher.Id).ToListAsync(ct);
        foreach (var account in accounts)
            account.Rename(teacher.FirstName, teacher.LastName, command);

        // refused before anything is saved, so the record keeps its previous values
        var login = await _teacherLogin.SaveWithLoginAsync(teacher, command.Password, command, ct);
        if (login.Status == TeacherLoginStatus.ExistsUnmanaged)
            throw new ConflictException(TeacherLogin.UnmanagedEmailMessage(teacher));

        return new UpdateTeacherResponse(teacher.Id, login.Status, login.UserId);
    }
}
