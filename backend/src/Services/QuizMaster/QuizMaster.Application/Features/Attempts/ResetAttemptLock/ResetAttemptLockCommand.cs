namespace QuizMaster.Application.Features.Attempts.ResetAttemptLock;

// Forgets the attempt entirely: the student's next entry starts from the confirmation dialog. Staff only.
public record ResetAttemptLockCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.ResetAttemptLock;
}

public class ResetAttemptLockCommandValidator : QuizMasterCommandValidator<ResetAttemptLockCommand>;
