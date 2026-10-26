namespace QuizMaster.Domain.Tests;

public class TeachingRoomTests
{
    private const int OtherTeacherId = 6;

    private static readonly Stage SecondaryStage = Stage.Create("Secondary", 3, TestData.Action(QuizMasterActionType.CreateStage, TestData.AdminId)).WithId(10);
    private static readonly Grade FirstYear = Grade.Create(SecondaryStage, "First year", 1, TestData.Action(QuizMasterActionType.CreateGrade, TestData.AdminId)).WithId(20);
    private static readonly Subject Programming = Subject.Create("Programming", null, [], TestData.Action(QuizMasterActionType.CreateSubject, TestData.AdminId)).WithId(40);
    private static readonly Subject Science = Subject.Create("Science", null, [], TestData.Action(QuizMasterActionType.CreateSubject, TestData.AdminId)).WithId(41);

    private static Teacher RosterTeacher(params Subject[] subjects)
        => Teacher.Create("Mona", "Adel", null, null, subjects.Length == 0 ? [Programming] : subjects,
            TestData.Action(QuizMasterActionType.CreateTeacher, TestData.AdminId)).WithId(50);

    private static MaterialLessonDraft Lesson(int order, string code)
        => new(order, code, $"Lesson {code}", """[{"type":"paragraph","text":"Hello"}]""", """{"title":"الشرح","items":[]}""");

    // Units of 2 and 1 lessons: three items across a unit boundary.
    private static TeachingMaterial Material(int lessonsInFirstUnit = 2, int lessonsInSecondUnit = 1)
    {
        var units = new List<MaterialUnitDraft>
        {
            new(1, "Chapter", "Basics", null, null, "Big idea", "الفكرة", [],
                Enumerable.Range(1, lessonsInFirstUnit).Select(order => Lesson(order, $"1-{order}")).ToList())
        };
        if (lessonsInSecondUnit > 0)
            units.Add(new(2, "Chapter", "More", null, null, "Big idea", "الفكرة", [],
                Enumerable.Range(1, lessonsInSecondUnit).Select(order => Lesson(order, $"2-{order}")).ToList()));

        var draft = new MaterialDraft("room-material", "Programming and AI", null, null, Semester.First, "{}", units);
        return TeachingMaterial.Create(draft, Programming, FirstYear, RosterTeacher(),
            TestData.Action(QuizMasterActionType.CreateTeachingMaterial)).WithId(70);
    }

    private static TeachingRoom Open(TeachingMaterial? material = null)
        => TeachingRoom.Open(material ?? Material(), RosterTeacher(), TestData.Action(QuizMasterActionType.CreateTeachingRoom)).WithId(80);

    private static TestAction ByTeacher(QuizMasterActionType type) => TestData.Action(type, TestData.TeacherId);

    private static TeachingRoom WithRequest(int studentId = TestData.StudentId)
    {
        var room = Open();
        room.RequestToJoin(studentId, TestData.Action(QuizMasterActionType.RequestToJoinTeachingRoom, studentId));
        return room;
    }

    // ---- opening ----

    [Fact]
    public void A_teacher_opens_a_room_on_the_first_item_of_their_material()
    {
        var room = Open();

        Assert.Equal(70, room.TeachingMaterialId);
        Assert.Equal(Programming.Id, room.SubjectId);
        Assert.Equal(3, room.ItemCount);
        Assert.Equal(1, room.CurrentPosition);
        Assert.Equal(1, room.Revision);
        Assert.True(room.IsPresentedBy(TestData.TeacherId));
        Assert.Empty(room.Members);
    }

    [Fact]
    public void Only_the_uploader_presents_a_material()
    {
        var error = Assert.Throws<DomainException>(() => TeachingRoom.Open(
            Material(), RosterTeacher(), TestData.Action(QuizMasterActionType.CreateTeachingRoom, OtherTeacherId)));
        Assert.Contains("you uploaded", error.Message);
    }

    [Fact]
    public void A_teacher_no_longer_teaching_the_subject_cannot_present_it()
    {
        var error = Assert.Throws<DomainException>(() => TeachingRoom.Open(
            Material(), RosterTeacher(Science), TestData.Action(QuizMasterActionType.CreateTeachingRoom)));
        Assert.Contains("subject you teach", error.Message);
    }

    // ---- Next and Previous ----

    [Fact]
    public void Previous_is_refused_on_the_first_item_and_the_position_stays()
    {
        var room = Open();

        Assert.False(room.CanGoPrevious);
        Assert.True(room.CanGoNext);
        var error = Assert.Throws<DomainException>(() => room.GoToPrevious(ByTeacher(QuizMasterActionType.MoveTeachingRoomItem)));
        Assert.Contains("first item", error.Message);
        Assert.Equal(1, room.CurrentPosition);
        Assert.Equal(1, room.Revision);
    }

    [Fact]
    public void Next_walks_across_units_to_the_last_item_and_is_refused_there()
    {
        var room = Open();
        var move = ByTeacher(QuizMasterActionType.MoveTeachingRoomItem);

        room.GoToNext(move);
        Assert.Equal(2, room.CurrentPosition);
        Assert.True(room.CanGoPrevious);
        Assert.True(room.CanGoNext);

        room.GoToNext(move);                                     // into the second unit
        Assert.Equal(3, room.CurrentPosition);
        Assert.True(room.CanGoPrevious);
        Assert.False(room.CanGoNext);

        var error = Assert.Throws<DomainException>(() => room.GoToNext(move));
        Assert.Contains("last item", error.Message);
        Assert.Equal(3, room.CurrentPosition);
    }

    [Fact]
    public void Previous_comes_back_to_the_first_item()
    {
        var room = Open();
        var move = ByTeacher(QuizMasterActionType.MoveTeachingRoomItem);
        room.GoToNext(move);
        room.GoToNext(move);

        room.GoToPrevious(move);
        room.GoToPrevious(move);

        Assert.Equal(1, room.CurrentPosition);
        Assert.False(room.CanGoPrevious);
        Assert.Throws<DomainException>(() => room.GoToPrevious(move));
    }

    [Fact]
    public void A_single_item_room_has_neither_previous_nor_next()
    {
        var room = Open(Material(lessonsInFirstUnit: 1, lessonsInSecondUnit: 0));
        var move = ByTeacher(QuizMasterActionType.MoveTeachingRoomItem);

        Assert.Equal(1, room.ItemCount);
        Assert.False(room.CanGoPrevious);
        Assert.False(room.CanGoNext);
        Assert.Throws<DomainException>(() => room.GoToNext(move));
        Assert.Throws<DomainException>(() => room.GoToPrevious(move));
        Assert.Equal(1, room.CurrentPosition);
    }

    [Fact]
    public void Every_move_raises_the_revision()
    {
        var room = Open();
        var move = ByTeacher(QuizMasterActionType.MoveTeachingRoomItem);

        room.GoToNext(move);
        room.GoToPrevious(move);

        Assert.Equal(1, room.CurrentPosition);
        Assert.Equal(3, room.Revision);                         // back where it started, but two states newer
    }

    [Fact]
    public void Only_the_presenting_teacher_moves_the_board()
    {
        var room = Open();

        Assert.Throws<DomainException>(() => room.GoToNext(TestData.Action(QuizMasterActionType.MoveTeachingRoomItem, OtherTeacherId)));
        Assert.Throws<DomainException>(() => room.GoToNext(TestData.Action(QuizMasterActionType.MoveTeachingRoomItem, TestData.StudentId)));
        Assert.Equal(1, room.CurrentPosition);
    }

    // ---- joining ----

    [Fact]
    public void A_student_asking_to_join_waits_for_the_teacher()
    {
        var room = WithRequest();

        var member = Assert.Single(room.Members);
        Assert.Equal(TestData.StudentId, member.StudentId);
        Assert.Equal(TeachingRoomMemberStatus.Pending, member.Status);
        Assert.False(member.IsApproved);
        Assert.Equal(TestData.Now, member.RequestedOn);
    }

    [Fact]
    public void Asking_again_changes_nothing()
    {
        var room = WithRequest();
        room.Reject(TestData.StudentId, ByTeacher(QuizMasterActionType.RejectTeachingRoomMember));

        var member = room.RequestToJoin(TestData.StudentId, TestData.Action(QuizMasterActionType.RequestToJoinTeachingRoom, TestData.StudentId));

        Assert.Single(room.Members);
        Assert.Equal(TeachingRoomMemberStatus.Rejected, member.Status);   // a turned-away student cannot re-open their request
    }

    [Fact]
    public void The_teacher_admits_removes_and_readmits_a_student()
    {
        var room = WithRequest();

        Assert.True(room.Approve(TestData.StudentId, ByTeacher(QuizMasterActionType.ApproveTeachingRoomMember)));
        var member = room.MemberFor(TestData.StudentId)!;
        Assert.True(member.IsApproved);
        Assert.Equal(TestData.TeacherId, member.DecidedById);

        Assert.True(room.Reject(TestData.StudentId, ByTeacher(QuizMasterActionType.RejectTeachingRoomMember)));
        Assert.Equal(TeachingRoomMemberStatus.Rejected, member.Status);

        Assert.True(room.Approve(TestData.StudentId, ByTeacher(QuizMasterActionType.ApproveTeachingRoomMember)));
        Assert.True(member.IsApproved);
    }

    [Fact]
    public void Deciding_the_same_way_twice_changes_nothing()
    {
        var room = WithRequest();
        room.Approve(TestData.StudentId, ByTeacher(QuizMasterActionType.ApproveTeachingRoomMember));

        Assert.False(room.Approve(TestData.StudentId, ByTeacher(QuizMasterActionType.ApproveTeachingRoomMember)));
        Assert.True(room.MemberFor(TestData.StudentId)!.IsApproved);
    }

    [Fact]
    public void A_student_who_never_asked_cannot_be_admitted()
    {
        var room = WithRequest();

        var error = Assert.Throws<DomainException>(() => room.Approve(TestData.OtherStudentId, ByTeacher(QuizMasterActionType.ApproveTeachingRoomMember)));
        Assert.Contains("not asked", error.Message);
    }

    [Fact]
    public void Only_the_presenting_teacher_decides_who_joins()
    {
        var room = WithRequest();

        Assert.Throws<DomainException>(() => room.Approve(TestData.StudentId, TestData.Action(QuizMasterActionType.ApproveTeachingRoomMember, OtherTeacherId)));
        Assert.Throws<DomainException>(() => room.Approve(TestData.StudentId, TestData.Action(QuizMasterActionType.ApproveTeachingRoomMember, TestData.StudentId)));
        Assert.Throws<DomainException>(() => room.Reject(TestData.StudentId, TestData.Action(QuizMasterActionType.RejectTeachingRoomMember, OtherTeacherId)));
        Assert.Equal(TeachingRoomMemberStatus.Pending, room.MemberFor(TestData.StudentId)!.Status);
    }
}
