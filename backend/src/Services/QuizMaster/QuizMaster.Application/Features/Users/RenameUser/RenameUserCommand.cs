namespace QuizMaster.Application.Features.Users.RenameUser;

// The name the app shows for someone. Their email and sign-in stay as they are.
public record RenameUserCommand(string FirstName, string LastName) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.RenameUser;
}

public class RenameUserCommandValidator : QuizMasterCommandValidator<RenameUserCommand>
{
    public RenameUserCommandValidator()
    {
        RuleFor(c => c.FirstName).NotEmptyWithMessage(nameof(RenameUserCommand.FirstName)).MaximumLengthWithMessage(MaxLength.C128, nameof(RenameUserCommand.FirstName));
        RuleFor(c => c.LastName).NotEmptyWithMessage(nameof(RenameUserCommand.LastName)).MaximumLengthWithMessage(MaxLength.C128, nameof(RenameUserCommand.LastName));
    }
}
