using QuizMaster.Application.Features.Attempts.Shared;

namespace QuizMaster.Application.Features.Attempts.StartAttempt;

// Opens a "One Time Join" sitting: call it when the student confirms the warning, BEFORE showing the questions.
// Refused while a previous sitting of the same work is still locked.
public record StartAttemptCommand(int? HomeworkId, int? BankQuizId, int? TeacherQuizId)
    : QuizMasterCommand<AttemptLockDto>, IAttemptTarget
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.StartAttempt;
}

public class StartAttemptCommandValidator : AbstractValidator<StartAttemptCommand>
{
    public StartAttemptCommandValidator() => this.AddAttemptTargetRules();
}
