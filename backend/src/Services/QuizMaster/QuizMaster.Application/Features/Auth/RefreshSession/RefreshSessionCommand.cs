using QuizMaster.Application.SignIn;

namespace QuizMaster.Application.Features.Auth.RefreshSession;

// Spends a refresh token for a new access token and a new refresh token. Anonymous: the access token may have expired.
public record RefreshSessionCommand(string RefreshToken) : ICommand<SessionTokens>;

public class RefreshSessionCommandValidator : AbstractValidator<RefreshSessionCommand>
{
    public RefreshSessionCommandValidator()
        => RuleFor(c => c.RefreshToken).NotEmptyWithMessage(nameof(RefreshSessionCommand.RefreshToken)).MaximumLengthWithMessage(MaxLength.C128, nameof(RefreshSessionCommand.RefreshToken));
}

public class RefreshSessionCommandHandler(SignInSessions _sessions) : IRequestHandler<RefreshSessionCommand, SessionTokens>
{
    public Task<SessionTokens> Handle(RefreshSessionCommand command, CancellationToken ct) => _sessions.RefreshAsync(command.RefreshToken, ct);
}
