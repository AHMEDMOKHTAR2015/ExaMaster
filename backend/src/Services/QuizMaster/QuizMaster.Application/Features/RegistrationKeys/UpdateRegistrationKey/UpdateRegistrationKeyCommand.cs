namespace QuizMaster.Application.Features.RegistrationKeys.UpdateRegistrationKey;

// Edit, renew (a later expiry + active) or switch off a key. The role and the family that claimed it never change.
public record UpdateRegistrationKeyCommand(bool IsActive, DateTime? ExpiresOn, int? MaxChildren) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.UpdateRegistrationKey;
}

public class UpdateRegistrationKeyCommandValidator : QuizMasterCommandValidator<UpdateRegistrationKeyCommand>
{
    public UpdateRegistrationKeyCommandValidator()
    {
        RuleFor(c => c.MaxChildren).GreaterThanOrEqualTo(0);
    }
}
