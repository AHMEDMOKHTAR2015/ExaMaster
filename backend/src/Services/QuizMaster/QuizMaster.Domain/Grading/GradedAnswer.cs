namespace QuizMaster.Domain.Grading;

// One blank's outcome in a Complete question. IsCorrect is an exact-match SUGGESTION for the teacher, not a verdict.
public sealed record GradedBlank(int Index, string? UserAnswer, string CorrectAnswer, bool IsCorrect);

// One question's submitted-vs-correct breakdown, persisted so the attempt can be reviewed without the (mutable) quiz.
// Choose / Right or Wrong: the option fields. Complete: Blanks. Explain: ResponseText / ReferenceAnswer.
public sealed record GradedAnswer(
    int QuestionId,
    string QuestionName,
    int? SelectedOptionId,
    string? SelectedOptionText,
    int? CorrectOptionId,
    string? CorrectOptionText,
    bool IsCorrect,
    IReadOnlyList<GradedBlank>? Blanks,
    string? ResponseText,
    string? ReferenceAnswer,
    double WeightPercent,        // frozen at submission: a teacher grades against the weighting the attempt actually had
    double? EarnedPercent,       // null while a teacher's mark is pending
    bool RequiresReview);

// Everything an attempt resolves to.
public sealed record QuizGrade(
    IReadOnlyList<GradedAnswer> Answers,
    int Score,                   // raw count of correct auto-graded questions, NOT a percentage
    int ScorePercent,            // weighted 0–100, rises as pending answers are marked
    int CorrectCount,
    int WrongCount,
    int PendingReviewCount);
