namespace QuizMaster.Application.Features.Accounts.Shared;

public enum TeacherLoginStatus
{
    Created = 1,                 // a new sign-in with the given password
    Linked = 2,                  // an account of this organization with that email now carries the teacher role
    SkippedNoEmail = 3,          // the roster record has no email, so there is nothing to sign in with
    ExistsUnmanaged = 4,         // the email already signs in to an account that is not this organization's
}

public record TeacherLoginResponse(TeacherLoginStatus Status, int? UserId);

// Saves a roster teacher together with their sign-in: both are kept, or neither. A new teacher (Id 0) is added here.
//insight - a new teacher is added only inside the transaction, after the sign-in exists: ISignInAccounts.CreateAsync
// saves the shared context, so a teacher tracked before it would be committed even if the login then failed. An
// existing teacher's edits ARE committed by it; if the profile then fails to save, the edit stays without a login,
// and saving again is safe.
public class TeacherLogin(
    QuizMasterDbContext _dbContext,
    Repository<Teacher> _teacherRepository,
    Repository<User> _userRepository,
    ISignInAccounts _signInAccounts,
    ITenantProvider _tenantProvider)
{
    public static string UnmanagedEmailMessage(Teacher teacher)
        => $"{teacher.Email} already signs in to an account outside this school. Use a different email for {teacher.FullName}.";

    // On ExistsUnmanaged nothing is saved: the caller decides whether that refuses the whole command.
    public async Task<TeacherLoginResponse> SaveWithLoginAsync(Teacher teacher, string? password, IQuizMasterAction action, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(teacher.Email))
        {
            await SaveTeacherAsync(teacher, ct);
            return new TeacherLoginResponse(TeacherLoginStatus.SkippedNoEmail, null);
        }

        var email = teacher.Email.Trim().ToLowerInvariant();

        // An account of THIS organization with that email (the tenant filter keeps the search to it).
        var existing = await _userRepository.Query().Where(user => user.Email == email).OrderBy(user => user.Id).FirstOrDefaultAsync(ct);
        if (existing is not null)
            return await _dbContext.InTransactionAsync(async () =>
            {
                await SaveTeacherAsync(teacher, ct);                 // the link needs the teacher's id
                if (!existing.IsTeacher)
                    existing.AssignRoles([.. existing.Roles, UserRoleType.TEACHER], action);
                existing.LinkToTeacherRecord(teacher, action);
                await _userRepository.SaveChangesAsync(ct);
                return new TeacherLoginResponse(TeacherLoginStatus.Linked, existing.Id);
            }, ct);

        //insight - an email that already signs in is NOT adopted as this teacher's login: it belongs to somebody,
        // possibly at another school, and adopting it would hand them teacher access here. It is simply refused.
        if (await _signInAccounts.FindUidByEmailAsync(email, ct) is not null)
            return new TeacherLoginResponse(TeacherLoginStatus.ExistsUnmanaged, null);

        if (string.IsNullOrEmpty(password))
            throw new BadRequestException("A password is required to create the teacher's login.");
        var tenantId = _tenantProvider.TryGetTenantId() ?? throw new ForbiddenException("Only a member of an organization can create its accounts.");

        // registered elsewhere meanwhile → CreateAsync throws ConflictException before anything of ours is saved
        return await _signInAccounts.CreateThenPersistAsync(new NewSignInAccount(email, password, teacher.FullName), async uid =>
            await _dbContext.InTransactionAsync(async () =>
            {
                await SaveTeacherAsync(teacher, ct);                 // the link needs the teacher's id
                var user = User.Create(tenantId, uid, email, teacher.FullName, [UserRoleType.TEACHER], action,
                    teacher.FirstName, teacher.LastName, photoUrl: teacher.PhotoUrl);
                user.LinkToTeacherRecord(teacher, action);
                await _userRepository.AddAsync(user, ct);
                await _userRepository.SaveChangesAsync(ct);
                return new TeacherLoginResponse(TeacherLoginStatus.Created, user.Id);
            }, ct), ct);
    }

    private async Task SaveTeacherAsync(Teacher teacher, CancellationToken ct)
    {
        if (teacher.Id == 0)
            await _teacherRepository.AddAsync(teacher, ct);
        await _teacherRepository.SaveChangesAsync(ct);
    }
}
