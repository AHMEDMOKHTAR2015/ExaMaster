namespace QuizMaster.Application.Features.RegistrationKeys.DeleteRegistrationKey;

// Only a key nobody registered with: deleting one that admitted accounts would lock them out (409). Deactivate it instead.
public record DeleteRegistrationKeyCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.DeleteRegistrationKey;
}

public class DeleteRegistrationKeyCommandValidator : QuizMasterCommandValidator<DeleteRegistrationKeyCommand>;
