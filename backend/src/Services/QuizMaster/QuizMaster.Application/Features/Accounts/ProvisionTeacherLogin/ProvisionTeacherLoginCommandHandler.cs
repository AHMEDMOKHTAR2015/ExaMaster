namespace QuizMaster.Application.Features.Accounts.ProvisionTeacherLogin;

public class ProvisionTeacherLoginCommandHandler(
    Repository<Teacher> _teacherRepository,
    Repository<User> _userRepository,
    ISignInAccounts _signInAccounts,
    ITenantProvider _tenantProvider)
    : IRequestHandler<ProvisionTeacherLoginCommand, TeacherLoginResponse>
{
    public async Task<TeacherLoginResponse> Handle(ProvisionTeacherLoginCommand command, CancellationToken ct)
    {
        var teacher = Guard.NotFound(await _teacherRepository.GetByIdAsync(command.AggregateId, ct));
        if (string.IsNullOrWhiteSpace(teacher.Email))
            return new TeacherLoginResponse(TeacherLoginStatus.SkippedNoEmail, null);

        var email = teacher.Email.Trim().ToLowerInvariant();

        // An account of THIS organization with that email (the tenant filter keeps the search to it).
        var existing = await _userRepository.Query().Where(user => user.Email == email).OrderBy(user => user.Id).FirstOrDefaultAsync(ct);
        if (existing is not null)
        {
            if (!existing.IsTeacher)
                existing.AssignRoles([.. existing.Roles, UserRoleType.TEACHER], command);
            existing.LinkToTeacherRecord(teacher, command);
            await _userRepository.SaveChangesAsync(ct);
            return new TeacherLoginResponse(TeacherLoginStatus.Linked, existing.Id);
        }

        //insight - an email that already signs in is NOT adopted as this teacher's login: it belongs to somebody,
        // possibly at another school, and adopting it would hand them teacher access here. It is simply refused.
        if (await _signInAccounts.FindUidByEmailAsync(email, ct) is not null)
            return new TeacherLoginResponse(TeacherLoginStatus.ExistsUnmanaged, null);

        var tenantId = _tenantProvider.TryGetTenantId() ?? throw new ForbiddenException("Only a member of an organization can create its accounts.");
        return await _signInAccounts.CreateThenPersistAsync(new NewSignInAccount(email, command.Password, teacher.FullName), async uid =>
        {
            var user = User.Create(tenantId, uid, email, teacher.FullName, [UserRoleType.TEACHER], command,
                teacher.FirstName, teacher.LastName, photoUrl: teacher.PhotoUrl);
            user.LinkToTeacherRecord(teacher, command);
            await _userRepository.AddAsync(user, ct);
            await _userRepository.SaveChangesAsync(ct);
            return new TeacherLoginResponse(TeacherLoginStatus.Created, user.Id);
        }, ct);
    }
}
