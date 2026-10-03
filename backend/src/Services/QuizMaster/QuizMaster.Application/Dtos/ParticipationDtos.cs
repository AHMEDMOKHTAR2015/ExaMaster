namespace QuizMaster.Application.Dtos;

public record ParticipationSummaryDto(
    int Id,
    ParticipationType Type,
    int? BankQuizId,
    int? TeacherQuizId,
    string QuizName,
    int? HomeworkId,
    string? HomeworkTitle,
    int ChildId,
    string? ChildName,
    int? ReviewerId,
    int? ClassId,
    int Score,
    int ScorePercent,
    int CorrectCount,
    int WrongCount,
    int PendingReviewCount,
    DateTime StartedOn,
    DateTime EndedOn,
    ValidationStatus? ValidationStatus,
    AssignmentKind? AssignmentKind = null);                 // the answered assignment's kind; null when it answers none (a quiz)

public record ParticipationDto(
    int Id,
    ParticipationType Type,
    int? BankQuizId,
    int? TeacherQuizId,
    string QuizName,
    int? HomeworkId,
    string? HomeworkTitle,
    int ChildId,
    int? ParentId,
    int? ReviewerId,
    int? StageId,
    int? GradeId,
    int? ClassId,
    int Score,
    int ScorePercent,
    int CorrectCount,
    int WrongCount,
    int PendingReviewCount,
    DateTime StartedOn,
    DateTime EndedOn,
    ValidationDto? Validation,
    bool ResultsAvailable,                  // false: the correct answers below are withheld until the assignment is due
    IReadOnlyList<ParticipationAnswerDto> Answers);

public record ValidationDto(ValidationStatus Status, string? Feedback, int ValidatedById, DateTime ValidatedOn);

public record ParticipationAnswerDto(
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
    double WeightPercent,
    double? EarnedPercent,
    bool RequiresReview,
    int? SuggestedAward,                    // Complete: the exact-match starting mark for the teacher's field
    ManualGradeDto? ManualGrade);

public record ManualGradeDto(double AwardedPercent, string? Comment, int GradedById, DateTime GradedOn);
