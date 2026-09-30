namespace QuizMaster.Application.Features.RegistrationKeys.CreateRegistrationKey;

// A new key for the administrator's own organization (the tenant is stamped on save, never taken from the request).
public record CreateRegistrationKeyCommand(UserRoleType Role, DateTime? ExpiresOn, int? MaxChildren) : QuizMasterCommand<RegistrationKeyDto>
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.CreateRegistrationKey;
}

public class CreateRegistrationKeyCommandValidator : AbstractValidator<CreateRegistrationKeyCommand>
{
    public CreateRegistrationKeyCommandValidator()
    {
        RuleFor(c => c.Role).IsInEnum();
        RuleFor(c => c.MaxChildren).GreaterThanOrEqualTo(0);
    }
}
