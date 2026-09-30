namespace QuizMaster.Application.Features.Users.ActivateUser;

public record ActivateUserCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.ActivateUser;
}

public class ActivateUserCommandValidator : QuizMasterCommandValidator<ActivateUserCommand>;
