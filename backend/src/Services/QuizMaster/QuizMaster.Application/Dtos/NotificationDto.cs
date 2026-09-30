namespace QuizMaster.Application.Dtos;

public record NotificationDto(
    int Id,
    NotificationType Type,
    bool IsRead,
    DateTime CreatedOn,
    int ParticipationId,
    int? HomeworkId,
    string Title,
    int ChildId,
    string ChildName,
    int CorrectCount,
    int WrongCount,
    int PendingReviewCount,
    int TimeTakenSeconds,
    string? Feedback);
