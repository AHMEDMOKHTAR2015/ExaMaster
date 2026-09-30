using QuizMaster.Application.SignIn;

namespace QuizMaster.Application.Features.Auth.SignOut;

// Ends one session. Anonymous and idempotent: an unknown or already-ended token is simply nothing to end.
public record SignOutCommand(string RefreshToken) : ICommand;

public class SignOutCommandValidator : AbstractValidator<SignOutCommand>
{
    public SignOutCommandValidator()
        => RuleFor(c => c.RefreshToken).NotEmptyWithMessage(nameof(SignOutCommand.RefreshToken)).MaximumLengthWithMessage(MaxLength.C128, nameof(SignOutCommand.RefreshToken));
}

public class SignOutCommandHandler(SignInSessions _sessions) : IRequestHandler<SignOutCommand, Unit>
{
    public async Task<Unit> Handle(SignOutCommand command, CancellationToken ct)
    {
        await _sessions.SignOutAsync(command.RefreshToken, ct);
        return Unit.Value;
    }
}
