using QuizMaster.Application.SignIn;

namespace QuizMaster.Application.Features.Auth.SignIn;

// Email (a family's is built from their mobile number, as at registration) and password -> a session. Anonymous.
public record SignInCommand(string Email, string Password) : ICommand<SessionTokens>;

public class SignInCommandValidator : AbstractValidator<SignInCommand>
{
    public SignInCommandValidator()
    {
        RuleFor(c => c.Email).NotEmptyWithMessage(nameof(SignInCommand.Email)).MaximumLengthWithMessage(MaxLength.C256, nameof(SignInCommand.Email));
        RuleFor(c => c.Password).NotEmptyWithMessage(nameof(SignInCommand.Password)).MaximumLengthWithMessage(MaxLength.C128, nameof(SignInCommand.Password));
    }
}

public class SignInCommandHandler(SignInSessions _sessions) : IRequestHandler<SignInCommand, SessionTokens>
{
    public Task<SessionTokens> Handle(SignInCommand command, CancellationToken ct) => _sessions.SignInAsync(command.Email, command.Password, ct);
}
