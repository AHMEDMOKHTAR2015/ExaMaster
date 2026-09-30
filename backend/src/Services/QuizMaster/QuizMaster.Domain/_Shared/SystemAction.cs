namespace QuizMaster.Domain.Shared;

// An action nobody signed in performed: seeding, scheduled jobs. CreatedById 0 means "the system".
public sealed record SystemAction(QuizMasterActionType ActionType, DateTime CreatedOn, string? Comment = null) : IQuizMasterAction
{
    public int AggregateId => 0;
    public int CreatedById { get; set; }
    public string Action => ActionType.ToString();
}
