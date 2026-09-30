namespace QuizMaster.Application.Dtos;

public record AttemptLockDto(
    int Id,
    int ChildId,
    string? ChildName,
    string ScopeKey,
    int? BankQuizId,
    int? TeacherQuizId,
    int? HomeworkId,
    string QuizName,
    int? ClassId,
    AttemptLockStatus Status,
    bool IsBlocking,
    DateTime StartedOn,
    DateTime? LockedOn,
    int ExitAttempts,
    AttemptExitReason? LastExitReason,
    DateTime? ReleasedOn,
    int? ReleasedById);
