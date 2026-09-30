using QuizMaster.Application.Features.Accounts.Shared;

namespace QuizMaster.Application.Features.Auth.SetUserPassword;

//insight - there is no reset link: a child signs in with a mobile number and has no mailbox. So the people responsible
// for an account set its password — an administrator for anyone in their school, a parent for their own children.
// Setting one ends every session of that account, and lifts a lockout.
public record SetUserPasswordCommand(string Password) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.SetUserPassword;
}

public class SetUserPasswordCommandValidator : QuizMasterCommandValidator<SetUserPasswordCommand>
{
    public SetUserPasswordCommandValidator()
        => RuleFor(c => c.Password).MinimumLength(SignInEmail.MinimumPasswordLength).WithMessage(SignInEmail.PasswordMessage).MaximumLength(MaxLength.C128);
}

public class SetUserPasswordCommandHandler(Repository<User> _userRepository, ISignInAccounts _accounts, IClaimsProvider _claimsProvider)
    : IRequestHandler<SetUserPasswordCommand, IdResponse>
{
    public async Task<IdResponse> Handle(SetUserPasswordCommand command, CancellationToken ct)
    {
        // the tenant filter already keeps an administrator inside their own school
        var user = await _userRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        var callerId = _claimsProvider.GetUserId();
        var roles = _claimsProvider.GetUserRoles<UserRoleType>();
        var mayManage = roles.Contains(UserRoleType.APPLICATION_ADMIN) || (roles.Contains(UserRoleType.PARENT) && user.ParentId == callerId);
        if (!mayManage)
            throw new ForbiddenException("Only a school administrator, or a parent for their own child, may set this password.");

        await _accounts.SetPasswordAsync(user.SignInUid, user.Email, command.Password, ct);
        return new IdResponse(user.Id);
    }
}
