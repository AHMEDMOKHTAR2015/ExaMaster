namespace QuizMaster.Domain.Academic;

// A subject a class is taught (Math, Science, English, ...).
public partial class Subject : AggregateRoot, IMultitenancy
{
    private Subject() {}

    public int TenantId { get; set; }
    public string Name { get; private set; } = null!;
    public string? Color { get; private set; }                   // "#RRGGBB"
}
