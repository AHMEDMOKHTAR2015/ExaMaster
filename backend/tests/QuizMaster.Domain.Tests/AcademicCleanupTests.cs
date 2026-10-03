using static QuizMaster.Domain.Tests.TestData;

namespace QuizMaster.Domain.Tests;

// Classes and teachers keep their teacher/subject ids as JSON lists, so nothing in the database removes a deleted one.
public class AcademicCleanupTests
{
    private static readonly TestAction ByAdmin = Action(QuizMasterActionType.DeleteTeacher, AdminId);

    private static Subject Subject(int id, string name) => QuizMaster.Domain.Academic.Subject.Create(name, null, [], ByAdmin).WithId(id);

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

    // Who a teacher's students are (GET /me/students): the classes they are assigned to AND that study one of their subjects.
    [Fact]
    public void A_teacher_teaches_a_class_only_when_assigned_to_it_and_it_studies_one_of_their_subjects()
    {
        var (science, math) = (Subject(1, "Science"), Subject(2, "Math"));
        var (scienceTeacher, mathTeacher, unassigned) = (RosterTeacher(7, science), RosterTeacher(8, math), RosterTeacher(9, science));
        var grade = Grade.Create(Stage.Create("Primary", 1, ByAdmin).WithId(1), "G1", 1, ByAdmin).WithId(2);
        var scienceClass = ClassGroup.Create(grade, "1A", [scienceTeacher, mathTeacher], [science], ByAdmin);

        Assert.True(scienceClass.IsTaughtBy(scienceTeacher));
        Assert.False(scienceClass.IsTaughtBy(mathTeacher));      // assigned, but the class does not study Math
        Assert.False(scienceClass.IsTaughtBy(unassigned));       // the right subject, but not assigned
    }
}
