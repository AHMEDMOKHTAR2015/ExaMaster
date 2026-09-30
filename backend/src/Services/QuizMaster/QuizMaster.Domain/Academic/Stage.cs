namespace QuizMaster.Domain.Academic;

// An educational stage (e.g. Primary, Preparatory). Stage → Grade → ClassGroup is the school hierarchy.
public partial class Stage : AggregateRoot, IMultitenancy
{
    private Stage() {}

    public int TenantId { get; set; }
    public string Name { get; private set; } = null!;
    public int Order { get; private set; }
}
