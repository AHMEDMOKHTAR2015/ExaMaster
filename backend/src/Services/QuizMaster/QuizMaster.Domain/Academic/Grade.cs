namespace QuizMaster.Domain.Academic;

// A grade level inside a stage (e.g. "Grade 1" inside "Primary").
public partial class Grade : AggregateRoot, IMultitenancy
{
    private Grade() {}

    public int TenantId { get; set; }
    public int StageId { get; private set; }
    public string Name { get; private set; } = null!;
    public int Order { get; private set; }
}
