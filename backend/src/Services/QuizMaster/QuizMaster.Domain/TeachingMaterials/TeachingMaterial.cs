namespace QuizMaster.Domain.TeachingMaterials;

// A teacher's course material for one subject in one grade: a teaching summary imported from a JSON document,
// split into units and lessons. The uploader (CreatedById) owns it; it reaches the classes that uploader teaches.
public partial class TeachingMaterial : AggregateRoot, IMultitenancy
{
    private TeachingMaterial() {}                                // use TeachingMaterial.Create(...)

    public int TenantId { get; set; }

    //insight - the document's own id ("sec1-programming-ai-term1"): the same document uploaded twice by the same
    // teacher for the same subject and grade is a duplicate, whatever its title says
    public string SourceKey { get; private set; } = null!;
    public string Title { get; private set; } = null!;
    public string? Subtitle { get; private set; }
    public string? ForLabel { get; private set; }

    public int SubjectId { get; private set; }
    public int GradeId { get; private set; }
    public Semester? Semester { get; private set; }

    // The uploader's roster record: a class shows the material when this teacher teaches it (no foreign key, like ClassGroup.TeacherIds).
    public int TeacherId { get; private set; }

    // Front matter (guide, arc, contents, source notes...) kept as the document wrote it: shown, never queried.
    public string OverviewJson { get; private set; } = "{}";

    private readonly List<MaterialUnit> _units = new();
    public IReadOnlyList<MaterialUnit> Units => _units.AsReadOnly();
}
