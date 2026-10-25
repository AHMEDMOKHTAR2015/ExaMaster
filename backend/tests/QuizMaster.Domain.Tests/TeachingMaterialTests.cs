namespace QuizMaster.Domain.Tests;

public class TeachingMaterialTests
{
    private static readonly Stage SecondaryStage = Stage.Create("Secondary", 3, TestData.Action(QuizMasterActionType.CreateStage, TestData.AdminId)).WithId(10);
    private static readonly Grade FirstYear = Grade.Create(SecondaryStage, "First year", 1, TestData.Action(QuizMasterActionType.CreateGrade, TestData.AdminId)).WithId(20);
    private static readonly Grade SecondYear = Grade.Create(SecondaryStage, "Second year", 2, TestData.Action(QuizMasterActionType.CreateGrade, TestData.AdminId)).WithId(21);
    private static readonly Subject Programming = Subject.Create("Programming", null, [], TestData.Action(QuizMasterActionType.CreateSubject, TestData.AdminId)).WithId(40);
    private static readonly Subject Science = Subject.Create("Science", null, [], TestData.Action(QuizMasterActionType.CreateSubject, TestData.AdminId)).WithId(41);

    private static Teacher RosterTeacher(int id = 50, params Subject[] subjects)
        => Teacher.Create("Mona", "Adel", null, null, subjects.Length == 0 ? [Programming] : subjects,
            TestData.Action(QuizMasterActionType.CreateTeacher, TestData.AdminId)).WithId(id);

    private static MaterialLessonDraft Lesson(int order, string code)
        => new(order, code, $"Lesson {code}", """[{"type":"paragraph","text":"Hello"}]""", """{"title":"الشرح","items":[]}""");

    private static MaterialUnitDraft Unit(int number, params MaterialLessonDraft[] lessons)
        => new(number, "Chapter", $"Chapter {number}", 4, 11, "Big idea", "الفكرة", ["Takeaway"],
            lessons.Length == 0 ? [Lesson(1, $"{number}-1")] : lessons);

    private static MaterialDraft Draft(params MaterialUnitDraft[] units)
        => new("sec1-programming-ai-term1", "Programming and AI", "An introduction", "First year", Semester.First, "{}",
            units.Length == 0 ? [Unit(1), Unit(2)] : units);

    private static TeachingMaterial Create(MaterialDraft? draft = null, Subject? subject = null, Grade? grade = null, Teacher? uploader = null)
        => TeachingMaterial.Create(draft ?? Draft(), subject ?? Programming, grade ?? FirstYear, uploader ?? RosterTeacher(),
            TestData.Action(QuizMasterActionType.CreateTeachingMaterial));

    [Fact]
    public void A_teacher_uploads_material_for_their_own_subject()
    {
        var material = Create();

        Assert.Equal(Programming.Id, material.SubjectId);
        Assert.Equal(FirstYear.Id, material.GradeId);
        Assert.Equal(50, material.TeacherId);
        Assert.Equal(TestData.TeacherId, material.CreatedById);
        Assert.Equal(Semester.First, material.Semester);
        Assert.Equal(2, material.Units.Count);
        Assert.Equal(2, material.LessonCount);
        Assert.True(material.IsOwnedBy(TestData.TeacherId));
    }

    [Fact]
    public void A_teacher_cannot_upload_material_for_a_subject_they_do_not_teach()
    {
        var error = Assert.Throws<DomainException>(() => Create(subject: Science));
        Assert.Contains("subject you teach", error.Message);
    }

    [Fact]
    public void Units_are_kept_in_number_order()
    {
        var material = Create(Draft(Unit(3), Unit(1), Unit(2)));

        Assert.Equal([1, 2, 3], material.Units.Select(unit => unit.Number));
    }

    [Fact]
    public void A_material_needs_units_and_every_unit_needs_lessons()
    {
        Assert.Throws<DomainException>(() => Create(Draft() with { Units = [] }));
        var error = Assert.Throws<DomainException>(() => Create(Draft(Unit(1) with { Lessons = [] })));
        Assert.StartsWith("Unit 1:", error.Message);
    }

    [Fact]
    public void Unit_numbers_and_lesson_codes_are_unique()
    {
        Assert.Throws<DomainException>(() => Create(Draft(Unit(1), Unit(1))));
        var error = Assert.Throws<DomainException>(() => Create(Draft(Unit(1, Lesson(1, "1-1")), Unit(2, Lesson(1, "1-1")))));
        Assert.Contains("1-1", error.Message);
    }

    [Fact]
    public void Lessons_are_numbered_in_the_order_they_appear()
    {
        var error = Assert.Throws<DomainException>(() => Create(Draft(Unit(1, Lesson(1, "1-1"), Lesson(3, "1-2")))));
        Assert.StartsWith("Unit 1, lesson 2:", error.Message);
    }

    [Fact]
    public void A_material_needs_an_id_and_a_title()
    {
        Assert.Throws<DomainException>(() => Create(Draft() with { SourceKey = " " }));
        Assert.Throws<DomainException>(() => Create(Draft() with { Title = "" }));
        Assert.Throws<DomainException>(() => Create(Draft() with { Title = new string('a', TeachingMaterial.MaxTitleLength + 1) }));
    }

    [Fact]
    public void Only_the_uploaders_classes_of_its_grade_and_subject_see_it()
    {
        var uploader = RosterTeacher(50, Programming, Science);
        var colleague = RosterTeacher(51, Programming);
        var material = Create(uploader: uploader);

        ClassGroup ClassOf(Grade grade, Teacher teacher, Subject subject, int id)
            => ClassGroup.Create(grade, $"Class {id}", [teacher], [subject], TestData.Action(QuizMasterActionType.CreateClass, TestData.AdminId)).WithId(id);

        Assert.True(material.IsVisibleTo(ClassOf(FirstYear, uploader, Programming, 30)));
        Assert.False(material.IsVisibleTo(ClassOf(SecondYear, uploader, Programming, 31)));   // another grade
        Assert.False(material.IsVisibleTo(ClassOf(FirstYear, uploader, Science, 32)));        // another subject
        Assert.False(material.IsVisibleTo(ClassOf(FirstYear, colleague, Programming, 33)));   // a colleague's class
    }
}
