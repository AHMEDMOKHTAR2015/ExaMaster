namespace QuizMaster.Application.Features.Notifications.MarkNotificationRead;

// {id} = one of the caller's own notifications; anyone else's is simply not found.
public record MarkNotificationReadCommand : QuizMasterCommand
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.MarkNotificationsRead;
}

public class MarkNotificationReadCommandValidator : QuizMasterCommandValidator<MarkNotificationReadCommand>;
