using static QuizMaster.Domain.Tests.TestData;

namespace QuizMaster.Domain.Tests;

// Classes and teachers keep their teacher/subject ids as JSON lists, so nothing in the database removes a deleted one.
public class AcademicCleanupTests
{
    private static readonly TestAction ByAdmin = Action(QuizMasterActionType.DeleteTeacher, AdminId);

    private static Subject Subject(int id, string name) => QuizMaster.Domain.Academic.Subject.Create(name, null, ByAdmin).WithId(id);

    private static QuizMaster.Domain.Academic.Teacher RosterTeacher(int id, params Subject[] subjects) => QuizMaster.Domain.Academic.Teacher.Create("T", $"{id}", null, null, subjects, ByAdmin).WithId(id);

    [Fact]
    public void Unassigning_a_teacher_leaves_the_class_to_the_others()
    {
        var science = Subject(1, "Science");
        var (kept, removed) = (RosterTeacher(7, science), RosterTeacher(8, science));
        var grade = Grade.Create(Stage.Create("Primary", 1, ByAdmin).WithId(1), "G1", 1, ByAdmin).WithId(2);
        var classGroup = ClassGroup.Create(grade, "1A", [kept, removed], [science], ByAdmin);

        classGroup.Unassign(removed, ByAdmin);

        Assert.Equal([7], classGroup.TeacherIds);
    }

    [Fact]
    public void Dropping_a_subject_removes_it_from_classes_and_teachers()
    {
        var (science, math) = (Subject(1, "Science"), Subject(2, "Math"));
        var teacher = RosterTeacher(7, science, math);
        var grade = Grade.Create(Stage.Create("Primary", 1, ByAdmin).WithId(1), "G1", 1, ByAdmin).WithId(2);
        var classGroup = ClassGroup.Create(grade, "1A", [teacher], [science, math], ByAdmin);

        classGroup.Drop(math, ByAdmin);
        teacher.Drop(math, ByAdmin);

        Assert.Equal([1], classGroup.SubjectIds);
        Assert.Equal([1], teacher.SubjectIds);
    }
}
