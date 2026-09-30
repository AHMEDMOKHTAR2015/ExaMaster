namespace QuizMaster.Application.Features.Attempts.RecordAttemptExit;

// The browser saw the student leave. Best effort by nature: it is bookkeeping for the teacher, not what blocks re-entry.
public record RecordAttemptExitCommand(AttemptExitReason Reason) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.RecordAttemptExit;
}

public class RecordAttemptExitCommandValidator : QuizMasterCommandValidator<RecordAttemptExitCommand>
{
    public RecordAttemptExitCommandValidator() => RuleFor(c => c.Reason).IsInEnum();
}
