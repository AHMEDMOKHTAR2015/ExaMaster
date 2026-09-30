namespace QuizMaster.Domain.Notifications;

// One entry in a person's inbox, about one submission. Written only by the server, as a side effect of submitting or
// reviewing: the app let browsers post into each other's inboxes, which the rules could only fence by tenant.
//insight - everything shown is snapshotted when it is sent (titles, the child's name, the counts), like a message: a
// later rename or a re-mark must not rewrite what someone was already told
public partial class Notification : AggregateRoot, IMultitenancy
{
    private Notification() {}                                    // use Notification.For...(...)

    public int TenantId { get; set; }
    public int RecipientId { get; private set; }
    public NotificationType Type { get; private set; }
    public bool IsRead { get; private set; }

    public int ParticipationId { get; private set; }
    public int? HomeworkId { get; private set; }
    public string Title { get; private set; } = null!;           // the assignment's title, else the quiz's name

    public int ChildId { get; private set; }
    public string ChildName { get; private set; } = null!;
    public int CorrectCount { get; private set; }
    public int WrongCount { get; private set; }
    public int PendingReviewCount { get; private set; }
    public int TimeTakenSeconds { get; private set; }

    public string? Feedback { get; private set; }                // the teacher's words, on a verdict
}
