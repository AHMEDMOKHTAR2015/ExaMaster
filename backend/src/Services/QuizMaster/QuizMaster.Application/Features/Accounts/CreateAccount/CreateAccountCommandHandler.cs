using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.Accounts.CreateAccount;

public class CreateAccountCommandHandler(
    QuizMasterDbContext _dbContext,
    Repository<User> _userRepository,
    Repository<RegistrationKey> _keyRepository,
    FamilyEnrolment _enrolment,
    ISignInAccounts _signInAccounts,
    ITenantProvider _tenantProvider)
    : IRequestHandler<CreateAccountCommand, IdResponse>
{
    public async Task<IdResponse> Handle(CreateAccountCommand command, CancellationToken ct)
    {
        var email = SignInEmail.For(command.Email, command.MobileNumber);
        var signIn = new NewSignInAccount(email, command.Password, SignInEmail.DisplayName(command.FirstName, command.LastName));

        return command.Kind == NewAccountKind.Student
            ? await CreateStudentAsync(command, email, signIn, ct)
            : await CreateAdultAsync(command, email, signIn, ct);
    }

    private async Task<IdResponse> CreateStudentAsync(CreateAccountCommand command, string email, NewSignInAccount signIn, CancellationToken ct)
    {
        var (parent, key, classGroup) = await _enrolment.ChargeSlotAsync(command.ParentId!.Value, command.ClassId!.Value, command, ct);

        return await _signInAccounts.CreateThenPersistAsync(signIn, async uid =>
        {
            var child = FamilyEnrolment.CreateChild(uid, email, command.FirstName, command.LastName, command.MobileNumber, parent, key, classGroup, command);
            await _userRepository.AddAsync(child, ct);
            await _userRepository.SaveChangesAsync(ct);
            return new IdResponse(child.Id);
        }, ct);
    }

    private async Task<IdResponse> CreateAdultAsync(CreateAccountCommand command, string email, NewSignInAccount signIn, CancellationToken ct)
    {
        var tenantId = _tenantProvider.TryGetTenantId() ?? throw new ForbiddenException("Only a member of an organization can create its accounts.");
        var key = await LoadKeyAsync(command.RegistrationKeyCode, ct);

        var role = command.Kind switch
        {
            NewAccountKind.ApplicationAdmin => UserRoleType.APPLICATION_ADMIN,
            NewAccountKind.Teacher => UserRoleType.TEACHER,
            _ => UserRoleType.PARENT
        };
        if (role == UserRoleType.PARENT)
            key!.EnsureOpenForRegistration(command.CreatedOn);       // checked before the sign-in exists

        return await _signInAccounts.CreateThenPersistAsync(signIn, async uid =>
            await _dbContext.InTransactionAsync(async () =>
            {
                var user = User.Create(tenantId, uid, email, signIn.DisplayName, [role], command,
                    command.FirstName, command.LastName, command.MobileNumber);
                await _userRepository.AddAsync(user, ct);
                await _userRepository.SaveChangesAsync(ct);          // a parent key is claimed by the new user's id

                if (key is not null)
                {
                    user.HoldRegistrationKey(key, command);
                    if (key.IsParentKey)
                        key.ClaimFor(user, command);
                    await _userRepository.SaveChangesAsync(ct);
                }

                return new IdResponse(user.Id);
            }, ct), ct);
    }

    // Found through the tenant filter: an administrator can only hand out their own organization's keys.
    private async Task<RegistrationKey?> LoadKeyAsync(string? code, CancellationToken ct)
        => string.IsNullOrWhiteSpace(code)
            ? null
            : await _keyRepository.Query().SingleOrDefaultAsync(key => key.Code == code.Trim(), ct)
              ?? throw new BadRequestException("Registration key not found.");
}
