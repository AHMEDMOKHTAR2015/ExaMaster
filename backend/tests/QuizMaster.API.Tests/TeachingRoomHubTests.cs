using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Http.Connections;
using QuizMaster.API.Realtime;
using static QuizMaster.API.Tests.SeededSchool;

namespace QuizMaster.API.Tests;

// The live board end to end: real connections (WebSockets, and long polling, where a hub method runs outside any request),
// real groups, the database deciding every join.
[Collection(TeachingRoomCollection.Name)]
public class TeachingRoomHubTests(TeachingRoomApi api)
{
    public static TheoryData<HttpTransportType> Transports => new() { HttpTransportType.WebSockets, HttpTransportType.LongPolling };

    [Theory]
    [MemberData(nameof(Transports))]
    public async Task A_broadcast_to_one_room_never_reaches_another(HttpTransportType transport)
    {
        var firstRoom = await api.OpenRoomWithAsync(StudentUid);
        var secondRoom = await api.OpenRoomWithAsync(ClassmateUid);
        await using var teacher = await api.ConnectAsync(TeacherUid, transport);
        await using var inFirst = await api.ConnectAsync(StudentUid, transport);
        await using var inSecond = await api.ConnectAsync(ClassmateUid, transport);
        Assert.Equal(TeachingRoomAdmission.Teacher, (await teacher.JoinRoomAsync(firstRoom)).Admission);
        Assert.Equal(TeachingRoomAdmission.Teacher, (await teacher.JoinRoomAsync(secondRoom)).Admission);
        Assert.Equal(TeachingRoomAdmission.Approved, (await inFirst.JoinRoomAsync(firstRoom)).Admission);
        Assert.Equal(TeachingRoomAdmission.Approved, (await inSecond.JoinRoomAsync(secondRoom)).Admission);

        (await api.MoveAsync(firstRoom, "next")).EnsureSuccessStatusCode();

        var move = await inFirst.NextAsync(TeachingRoomHub.CurrentItemChanged);
        Assert.Equal(firstRoom, move.State!.RoomId);
        Assert.Equal(2, move.State.Position);
        Assert.Equal(firstRoom, (await teacher.NextAsync(TeachingRoomHub.CurrentItemChanged)).RoomId);
        await inSecond.AssertNothingReceivedAsync();

        // and the other way round
        (await api.MoveAsync(secondRoom, "next")).EnsureSuccessStatusCode();

        Assert.Equal(secondRoom, (await inSecond.NextAsync(TeachingRoomHub.CurrentItemChanged)).RoomId);
        Assert.Equal(secondRoom, (await teacher.NextAsync(TeachingRoomHub.CurrentItemChanged)).RoomId);
        await inFirst.AssertNothingReceivedAsync();
    }

    [Theory]
    [MemberData(nameof(Transports))]
    public async Task Unauthorized_join_attempts_are_refused_and_receive_nothing(HttpTransportType transport)
    {
        var roomId = await api.OpenRoomAsync();
        await using var teacher = await api.ConnectAsync(TeacherUid, transport);
        await teacher.JoinRoomAsync(roomId);

        await using var outsider = await api.ConnectAsync(OutsiderUid, transport);              // a class the material does not reach
        await using var foreigner = await api.ConnectAsync(ForeignStudentUid, transport);       // another school
        await using var otherTeacher = await api.ConnectAsync(OtherTeacherUid, transport);      // not the presenting teacher
        foreach (var refused in new[] { outsider, foreigner, otherTeacher })
        {
            var join = await refused.JoinRoomAsync(roomId);
            Assert.Equal(TeachingRoomAdmission.None, join.Admission);
            Assert.Null(join.State);
        }
        Assert.Equal(TeachingRoomAdmission.None, (await outsider.JoinRoomAsync(int.MaxValue)).Admission);   // no such room

        (await api.MoveAsync(roomId, "next")).EnsureSuccessStatusCode();

        await teacher.NextAsync(TeachingRoomHub.CurrentItemChanged);
        await outsider.AssertNothingReceivedAsync();
        await foreigner.AssertNothingReceivedAsync();
        await otherTeacher.AssertNothingReceivedAsync();
    }

    [Fact]
    public async Task Only_teachers_and_students_can_connect_at_all()
    {
        var refused = await Assert.ThrowsAnyAsync<HttpRequestException>(() => api.ConnectAsync(ParentUid));
        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);
    }

    [Theory]
    [MemberData(nameof(Transports))]
    public async Task Pending_and_rejected_students_receive_no_content(HttpTransportType transport)
    {
        var roomId = await api.OpenRoomAsync();
        (await api.RequestToJoinAsync(ThirdStudentUid, roomId)).EnsureSuccessStatusCode();     // stays pending
        (await api.RequestToJoinAsync(FourthStudentUid, roomId)).EnsureSuccessStatusCode();
        (await api.DecideAsync(roomId, FourthStudentUid, "reject")).EnsureSuccessStatusCode();
        await using var teacher = await api.ConnectAsync(TeacherUid, transport);
        await teacher.JoinRoomAsync(roomId);
        await using var pending = await api.ConnectAsync(ThirdStudentUid, transport);
        await using var rejected = await api.ConnectAsync(FourthStudentUid, transport);

        var pendingJoin = await pending.JoinRoomAsync(roomId);
        var rejectedJoin = await rejected.JoinRoomAsync(roomId);
        Assert.Equal(TeachingRoomAdmission.Pending, pendingJoin.Admission);
        Assert.Null(pendingJoin.State);
        Assert.Equal(TeachingRoomAdmission.Rejected, rejectedJoin.Admission);
        Assert.Null(rejectedJoin.State);

        (await api.MoveAsync(roomId, "next")).EnsureSuccessStatusCode();

        await teacher.NextAsync(TeachingRoomHub.CurrentItemChanged);
        await pending.AssertNothingReceivedAsync();
        await rejected.AssertNothingReceivedAsync();

        // nor through the API
        Assert.Equal(HttpStatusCode.Forbidden, (await api.ClientFor(ThirdStudentUid).GetAsync($"/api/teaching-rooms/{roomId}/state")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await api.ClientFor(FourthStudentUid).GetAsync($"/api/teaching-rooms/{roomId}/state")).StatusCode);
    }

    [Theory]
    [MemberData(nameof(Transports))]
    public async Task Admitting_and_removing_a_student_takes_effect_live(HttpTransportType transport)
    {
        var roomId = await api.OpenRoomAsync();
        await using var teacher = await api.ConnectAsync(TeacherUid, transport);
        await teacher.JoinRoomAsync(roomId);
        await using var student = await api.ConnectAsync(StudentUid, transport);
        Assert.Equal(TeachingRoomAdmission.MayRequest, (await student.JoinRoomAsync(roomId)).Admission);

        (await api.RequestToJoinAsync(StudentUid, roomId)).EnsureSuccessStatusCode();
        Assert.Equal(roomId, (await teacher.NextAsync(TeachingRoomHub.JoinRequestsChanged)).RoomId);    // the teacher's page hears of it

        (await api.DecideAsync(roomId, StudentUid, "approve")).EnsureSuccessStatusCode();
        var admitted = await student.NextAsync(TeachingRoomHub.Admitted);
        Assert.Equal(1, admitted.State!.Position);
        Assert.Equal("1-1", admitted.State.Item.Lesson.Code);

        (await api.MoveAsync(roomId, "next")).EnsureSuccessStatusCode();
        Assert.Equal(2, (await student.NextAsync(TeachingRoomHub.CurrentItemChanged)).State!.Position);
        await teacher.NextAsync(TeachingRoomHub.CurrentItemChanged);

        (await api.DecideAsync(roomId, StudentUid, "reject")).EnsureSuccessStatusCode();             // removed
        Assert.Equal(roomId, (await student.NextAsync(TeachingRoomHub.Removed)).RoomId);

        (await api.MoveAsync(roomId, "next")).EnsureSuccessStatusCode();
        await teacher.NextAsync(TeachingRoomHub.CurrentItemChanged);
        await student.AssertNothingReceivedAsync();

        // the page stays watched: admitted again, it is let back in with the board as it now is
        (await api.DecideAsync(roomId, StudentUid, "approve")).EnsureSuccessStatusCode();
        Assert.Equal(3, (await student.NextAsync(TeachingRoomHub.Admitted)).State!.Position);
    }

    [Theory]
    [MemberData(nameof(Transports))]
    public async Task A_reconnecting_client_rejoins_its_group_and_receives_the_current_state(HttpTransportType transport)
    {
        var roomId = await api.OpenRoomWithAsync(StudentUid);
        var before = await api.ConnectAsync(StudentUid, transport);
        Assert.Equal(1, (await before.JoinRoomAsync(roomId)).State!.Position);

        await before.StopAsync();                                   // the connection drops
        await before.DisposeAsync();
        (await api.MoveAsync(roomId, "next")).EnsureSuccessStatusCode();
        (await api.MoveAsync(roomId, "next")).EnsureSuccessStatusCode();

        await using var after = await api.ConnectAsync(StudentUid, transport);
        var rejoined = await after.JoinRoomAsync(roomId);
        Assert.Equal(TeachingRoomAdmission.Approved, rejoined.Admission);
        Assert.Equal(3, rejoined.State!.Position);
        Assert.Equal(3, rejoined.State.Revision);

        // and it is back in the group
        (await api.MoveAsync(roomId, "previous")).EnsureSuccessStatusCode();
        Assert.Equal(2, (await after.NextAsync(TeachingRoomHub.CurrentItemChanged)).State!.Position);
    }

    [Fact]
    public async Task Ending_a_room_tells_every_page_open_on_it()
    {
        var roomId = await api.OpenRoomWithAsync(StudentUid);
        (await api.RequestToJoinAsync(ClassmateUid, roomId)).EnsureSuccessStatusCode();
        await using var admitted = await api.ConnectAsync(StudentUid);
        await using var waiting = await api.ConnectAsync(ClassmateUid);
        await admitted.JoinRoomAsync(roomId);
        await waiting.JoinRoomAsync(roomId);

        (await api.ClientFor(TeacherUid).DeleteAsync($"/api/teaching-rooms/{roomId}")).EnsureSuccessStatusCode();

        Assert.Equal(roomId, (await admitted.NextAsync(TeachingRoomHub.RoomEnded)).RoomId);
        Assert.Equal(roomId, (await waiting.NextAsync(TeachingRoomHub.RoomEnded)).RoomId);
        Assert.Equal(TeachingRoomAdmission.None, (await admitted.JoinRoomAsync(roomId)).Admission);
    }

    [Fact]
    public async Task The_admission_rule_is_the_same_over_http()
    {
        var roomId = await api.OpenRoomAsync();

        var asStudent = await api.ClientFor(StudentUid).GetFromJsonAsync<RoomBody>($"/api/teaching-rooms/{roomId}", TeachingRoomApi.Json);
        Assert.Equal(TeachingRoomAdmission.MayRequest, asStudent!.Room.Admission);
        Assert.Null(asStudent.Room.Members);                     // the requests are the teacher's
        Assert.Equal(HttpStatusCode.Forbidden, (await api.ClientFor(OutsiderUid).GetAsync($"/api/teaching-rooms/{roomId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await api.ClientFor(ForeignStudentUid).GetAsync($"/api/teaching-rooms/{roomId}")).StatusCode);
    }

    private sealed record RoomBody(TeachingRoomDto Room);
}
