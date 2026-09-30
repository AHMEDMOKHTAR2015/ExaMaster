namespace QuizMaster.Application.Features.Notifications.MarkAllNotificationsRead;

// Every unread notification in the caller's inbox, not only the ones on screen.
public record MarkAllNotificationsReadCommand : QuizMasterCommand<MarkAllNotificationsReadResponse>
{
    public override QuizMasterActionType ActionType => QuizMasterActionType.MarkNotificationsRead;
}

public record MarkAllNotificationsReadResponse(int MarkedCount);
