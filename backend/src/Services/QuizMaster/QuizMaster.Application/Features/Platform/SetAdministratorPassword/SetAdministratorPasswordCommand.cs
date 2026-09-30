using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.Platform.SetAdministratorPassword;

//insight - the way into a school that has no working administrator login: its only administrator forgot their
// password. Only the platform administrator may, only for an
// administrator of that school, named by email — it reaches that one account's sign-in and nothing inside the school.
public record SetAdministratorPasswordCommand(string Email, string Password) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.SetAdministratorPassword;
}

public class SetAdministratorPasswordCommandValidator : QuizMasterCommandValidator<SetAdministratorPasswordCommand>
{
    public SetAdministratorPasswordCommandValidator()
    {
        RuleFor(c => c.Email).NotEmptyWithMessage(nameof(SetAdministratorPasswordCommand.Email)).MaximumLengthWithMessage(MaxLength.C256, nameof(SetAdministratorPasswordCommand.Email));
        RuleFor(c => c.Password).MinimumLength(SignInEmail.MinimumPasswordLength).WithMessage(SignInEmail.PasswordMessage).MaximumLength(MaxLength.C128);
    }
}

public class SetAdministratorPasswordCommandHandler(Repository<Tenant> _tenantRepository, QuizMasterDbContext _dbContext, ISignInAccounts _accounts)
    : IRequestHandler<SetAdministratorPasswordCommand, IdResponse>
{
    public async Task<IdResponse> Handle(SetAdministratorPasswordCommand command, CancellationToken ct)
    {
        var tenant = await _tenantRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        // The platform administrator belongs to no school, so the school's accounts are looked up across the filter.
        var email = command.Email.Trim();
        var administrator = await _dbContext.Users.IgnoreQueryFilters()
            .Where(user => user.TenantId == tenant.Id && user.Email == email && user.Roles.Contains(UserRoleType.APPLICATION_ADMIN))
            .Select(user => new { user.Id, user.SignInUid, user.Email })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException($"No administrator of {tenant.Name} signs in with {email}.");

        await _accounts.SetPasswordAsync(administrator.SignInUid, administrator.Email, command.Password, ct);
        return new IdResponse(administrator.Id);
    }
}
