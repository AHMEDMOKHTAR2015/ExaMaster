namespace QuizMaster.Domain.Academic;

public partial class ClassGroup
{
    public static ClassGroup Create(Grade grade, string name, IReadOnlyCollection<Teacher> teachers, IReadOnlyCollection<Subject> subjects, IQuizMasterAction action)
    {
        var classGroup = new ClassGroup { CreatedById = action.CreatedById, CreatedOn = action.CreatedOn };
        classGroup.Apply(grade, name, teachers, subjects);
        return classGroup;
    }

    public void Update(Grade grade, string name, IReadOnlyCollection<Teacher> teachers, IReadOnlyCollection<Subject> subjects, IQuizMasterAction action)
    {
        Apply(grade, name, teachers, subjects);
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    // A teacher or subject being deleted leaves no id behind: the lists are JSON, with no foreign key to clear them.
    public void Unassign(Teacher teacher, IQuizMasterAction action)
    {
        TeacherIds = TeacherIds.Where(id => id != teacher.Id).ToList();
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    public void Drop(Subject subject, IQuizMasterAction action)
    {
        SubjectIds = SubjectIds.Where(id => id != subject.Id).ToList();
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    public bool IsTaughtBy(Teacher teacher)
        => TeacherIds.Contains(teacher.Id) && SubjectIds.Intersect(teacher.SubjectIds).Any();

    private void Apply(Grade grade, string name, IReadOnlyCollection<Teacher> teachers, IReadOnlyCollection<Subject> subjects)
    {
        (StageId, GradeId) = (grade.StageId, grade.Id);
        Name = AcademicRules.RequiredName(name);
        TeacherIds = teachers.Select(teacher => teacher.Id).Distinct().Order().ToList();
        SubjectIds = subjects.Select(subject => subject.Id).Distinct().Order().ToList();
    }
}
