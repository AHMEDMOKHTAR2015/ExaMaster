namespace QuizMaster.Domain.Participations;

// One question's outcome within an attempt: what the student answered, what the answer was, and (for Explain
// and Complete) the teacher's mark. Persisted in full, always: reviewing needs the correct answer.
public class ParticipationAnswer : Entity
{
    private ParticipationAnswer() {}

    public int ParticipationId { get; private set; }
    public int Position { get; private set; }

    public int QuestionId { get; private set; }
    public string QuestionName { get; private set; } = null!;
    public int? SelectedOptionId { get; private set; }
    public string? SelectedOptionText { get; private set; }
    public int? CorrectOptionId { get; private set; }
    public string? CorrectOptionText { get; private set; }
    public bool IsCorrect { get; private set; }
    public IReadOnlyList<GradedBlank>? Blanks { get; private set; }
    public string? ResponseText { get; private set; }
    public string? ReferenceAnswer { get; private set; }

    public double WeightPercent { get; private set; }            // frozen at submission
    public double? EarnedPercent { get; private set; }            // null until a teacher marks a reviewed answer
    public bool RequiresReview { get; private set; }

    // The teacher's mark (Explain, Complete), once recorded.
    public double? AwardedPercent { get; private set; }
    public string? GradeComment { get; private set; }
    public int? GradedById { get; private set; }
    public DateTime? GradedOn { get; private set; }

    public bool IsMarked => GradedOn is not null;

    // Whole-percent cap for a teacher's mark: the answer's share of the quiz.
    public int MaxAward => QuizScoring.RoundPercent(WeightPercent);

    internal static ParticipationAnswer From(GradedAnswer answer, int position) => new()
    {
        Position = position,
        QuestionId = answer.QuestionId,
        QuestionName = answer.QuestionName,
        SelectedOptionId = answer.SelectedOptionId,
        SelectedOptionText = answer.SelectedOptionText,
        CorrectOptionId = answer.CorrectOptionId,
        CorrectOptionText = answer.CorrectOptionText,
        IsCorrect = answer.IsCorrect,
        Blanks = answer.Blanks,
        ResponseText = answer.ResponseText,
        ReferenceAnswer = answer.ReferenceAnswer,
        WeightPercent = answer.WeightPercent,
        EarnedPercent = answer.EarnedPercent,
        RequiresReview = answer.RequiresReview
    };

    internal void Mark(double awardedPercent, string? comment, IQuizMasterAction action)
    {
        if (!RequiresReview)
            throw new DomainException($"Question {QuestionId} is graded automatically and cannot be marked.");
        if (!double.IsFinite(awardedPercent) || awardedPercent < 0 || awardedPercent > MaxAward)
            throw new DomainException($"The mark for question {QuestionId} must be between 0 and {MaxAward}.");

        AwardedPercent = awardedPercent;
        EarnedPercent = awardedPercent;
        IsCorrect = awardedPercent >= MaxAward && awardedPercent > 0;  // a fully-credited answer reads as correct everywhere
        GradeComment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
        GradedById = action.CreatedById;
        GradedOn = action.CreatedOn;
    }

    public GradedAnswer ToGradedAnswer()
        => new(QuestionId, QuestionName, SelectedOptionId, SelectedOptionText, CorrectOptionId, CorrectOptionText, IsCorrect,
            Blanks, ResponseText, ReferenceAnswer, WeightPercent, EarnedPercent, RequiresReview);
}
