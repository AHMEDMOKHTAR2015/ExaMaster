namespace QuizMaster.Application.Features.Participations.ReviewSubmission;

// A teacher's review: marks for the Explain/Complete answers (0 up to each answer's weight) and a verdict.
// Rejected reopens an assignment for another attempt. Saved together, so nothing is approved unscored.
public record ReviewSubmissionCommand(ValidationStatus Status, string? Feedback, List<ReviewMark>? Marks) : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.ReviewSubmission;
}

public class ReviewSubmissionCommandValidator : QuizMasterCommandValidator<ReviewSubmissionCommand>
{
    public ReviewSubmissionCommandValidator()
    {
        RuleFor(c => c.Status).IsInEnum();
        RuleFor(c => c.Feedback).MaximumLengthWithMessage(Participation.MaxFeedbackLength, nameof(ReviewSubmissionCommand.Feedback));
        RuleForEach(c => c.Marks).ChildRules(mark =>
            mark.RuleFor(m => m.Comment).MaximumLengthWithMessage(MaxLength.C2048, nameof(ReviewMark.Comment)));
    }
}
