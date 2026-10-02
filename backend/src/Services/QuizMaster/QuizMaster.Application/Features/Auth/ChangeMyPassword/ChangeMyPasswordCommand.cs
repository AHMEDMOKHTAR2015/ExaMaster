using QuizMaster.Application.Features.Accounts.Shared;
using QuizMaster.Application.SignIn;

namespace QuizMaster.Application.Features.Auth.ChangeMyPassword;

// The signed-in person replaces their own password, proving they know the current one. Every session is signed out;
// the client signs in again with the new password.
public record ChangeMyPasswordCommand(string CurrentPassword, string NewPassword) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.ChangeMyPassword;
}

// No route id: the account is the caller's own.
public class ChangeMyPasswordCommandValidator : AbstractValidator<ChangeMyPasswordCommand>
{
    public ChangeMyPasswordCommandValidator()
    {
        RuleFor(c => c.CurrentPassword).NotEmptyWithMessage(nameof(ChangeMyPasswordCommand.CurrentPassword)).MaximumLength(MaxLength.C128);
        RuleFor(c => c.NewPassword).MustBeAcceptablePassword();
    }
}

public class ChangeMyPasswordCommandHandler(Repository<User> _userRepository, ISignInAccounts _accounts, SignInSessions _sessions, IClaimsProvider _claimsProvider)
    : IRequestHandler<ChangeMyPasswordCommand, IdResponse>
{
    public async Task<IdResponse> Handle(ChangeMyPasswordCommand command, CancellationToken ct)
    {
        var user = await _userRepository.GetByIdOrThrowAsync(_claimsProvider.GetUserId(), ct);
        if (!await _sessions.VerifyPasswordAsync(user.SignInUid, command.CurrentPassword, ct))
            throw new BadRequestException("The current password is not correct.");

        await _accounts.SetPasswordAsync(user.SignInUid, user.Email, command.NewPassword, ct);
        return new IdResponse(user.Id);
    }
}
