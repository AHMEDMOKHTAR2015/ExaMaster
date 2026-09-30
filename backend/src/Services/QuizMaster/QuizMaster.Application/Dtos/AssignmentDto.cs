namespace QuizMaster.Application.Dtos;

public record AssignmentDto(
    int Id,
    string Title,
    AssignmentKind Kind,
    QuizSource Source,
    int? BankQuizId,
    int? TeacherQuizId,
    string QuizName,
    int QuestionCount,                      // the quiz's shape, for a student's card: a student cannot read a teacher quiz
    int DurationSeconds,
    bool OneTimeJoin,                       // warn before opening it, and check for a lock
    int StageId,
    int? GradeId,
    int ClassId,
    int? SubjectId,
    Semester? Semester,
    DateTime DueAt,
    bool IsActive,
    IReadOnlyList<int> AssignedChildIds,
    int CreatedById,
    string? CreatedByName,
    DateTime CreatedOn,
    SubmissionStatusDto? Submission);

// A student's latest attempt at an assignment, for their own list (or their parent's view of it).
public record SubmissionStatusDto(int ParticipationId, int ScorePercent, int PendingReviewCount, ValidationStatus? ValidationStatus, DateTime EndedOn);
