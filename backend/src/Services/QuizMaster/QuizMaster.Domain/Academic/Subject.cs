namespace QuizMaster.Domain.Academic;

// A subject a class is taught (Math, Science, English, ...).
public partial class Subject : AggregateRoot, IMultitenancy
{
    private Subject() {}

    public int TenantId { get; set; }
    public string Name { get; private set; } = null!;
    public string? Color { get; private set; }                   // "#RRGGBB"

    // The topics its questions can be tagged with.
    private readonly List<SubjectTag> _tags = new();
    public IReadOnlyList<SubjectTag> Tags => _tags.AsReadOnly();
}
