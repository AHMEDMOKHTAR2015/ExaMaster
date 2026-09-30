namespace QuizMaster.Domain.Academic;

// A class of students inside a grade. A teacher "teaches" a class when assigned to it AND it studies one of their subjects.
public partial class ClassGroup : AggregateRoot, IMultitenancy
{
    private ClassGroup() {}

    public int TenantId { get; set; }
    public int StageId { get; private set; }                     // derived from the grade, never set independently
    public int GradeId { get; private set; }
    public string Name { get; private set; } = null!;

    public IReadOnlyList<int> TeacherIds { get; private set; } = [];   // roster Teacher ids
    public IReadOnlyList<int> SubjectIds { get; private set; } = [];
}
