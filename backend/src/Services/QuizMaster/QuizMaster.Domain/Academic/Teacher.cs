namespace QuizMaster.Domain.Academic;

// A teacher on the school's roster. Separate from User on purpose: a teacher can be listed and assigned to classes
// before they ever sign in. A signed-in teacher's User.TeacherId links the two.
public partial class Teacher : AggregateRoot, IMultitenancy
{
    private Teacher() {}

    public int TenantId { get; set; }
    public string FirstName { get; private set; } = null!;
    public string LastName { get; private set; } = null!;
    public string? Email { get; private set; }
    public string? PhotoUrl { get; private set; }
    public IReadOnlyList<int> SubjectIds { get; private set; } = [];

    public string FullName => $"{FirstName} {LastName}".Trim();
}
