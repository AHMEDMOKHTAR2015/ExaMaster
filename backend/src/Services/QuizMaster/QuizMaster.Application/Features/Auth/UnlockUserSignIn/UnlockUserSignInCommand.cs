namespace QuizMaster.Application.Features.Auth.UnlockUserSignIn;

// Five wrong passwords lock an account for a while; an administrator can let that person back in at once, keeping the
// password they have (setting a new one lifts a lockout too, but is not always what is wanted).
public record UnlockUserSignInCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.UnlockUserSignIn;
}

public class UnlockUserSignInCommandValidator : QuizMasterCommandValidator<UnlockUserSignInCommand>;

public class UnlockUserSignInCommandHandler(Repository<User> _userRepository, ISignInAccounts _accounts)
    : IRequestHandler<UnlockUserSignInCommand, IdResponse>
{
    public async Task<IdResponse> Handle(UnlockUserSignInCommand command, CancellationToken ct)
    {
        // the tenant filter already keeps an administrator inside their own school
        var user = await _userRepository.GetByIdOrThrowAsync(command.AggregateId, ct);

        await _accounts.UnlockAsync(user.SignInUid, ct);
        return new IdResponse(user.Id);
    }
}
