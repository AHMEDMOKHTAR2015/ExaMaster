namespace QuizMaster.Application.Features.Users.DeactivateUser;

// A deactivated account can still sign in, but holds no role until reactivated.
public record DeactivateUserCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.DeactivateUser;
}

public class DeactivateUserCommandValidator : QuizMasterCommandValidator<DeactivateUserCommand>;
