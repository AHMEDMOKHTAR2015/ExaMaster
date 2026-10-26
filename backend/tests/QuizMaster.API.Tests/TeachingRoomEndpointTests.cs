using System.Net;
using System.Net.Http.Json;
using static QuizMaster.API.Tests.SeededSchool;

namespace QuizMaster.API.Tests;

// The HTTP side of a teaching room: Next and Previous at the ends, and who may do what.
[Collection(TeachingRoomCollection.Name)]
public class TeachingRoomEndpointTests(TeachingRoomApi api)
{
    [Fact]
    public async Task Next_and_previous_stop_at_the_ends_and_report_where_they_can_go()
    {
        var roomId = await api.OpenRoomAsync();

        var first = await StateAsync(roomId);
        Assert.Equal((1, 3, false, true), (first.Position, first.ItemCount, first.CanGoPrevious, first.CanGoNext));
        Assert.Equal("1-1", first.Item.Lesson.Code);
        Assert.False(first.Item.ClosesUnit);

        // Previous on the first item: refused, and nothing moved
        Assert.Equal(HttpStatusCode.BadRequest, (await api.MoveAsync(roomId, "previous")).StatusCode);
        Assert.Equal((1, 1), ((await StateAsync(roomId)).Position, (await StateAsync(roomId)).Revision));

        var second = await MoveAsync(roomId, "next");
        Assert.Equal((2, true, true), (second.Position, second.CanGoPrevious, second.CanGoNext));
        Assert.Equal("1-2", second.Item.Lesson.Code);
        Assert.True(second.Item.ClosesUnit);                     // the unit's last lesson carries its takeaways
        Assert.Equal(["Takeaway one"], second.Item.KeyTakeaways);

        var last = await MoveAsync(roomId, "next");
        Assert.Equal((3, true, false), (last.Position, last.CanGoPrevious, last.CanGoNext));
        Assert.Equal((2, "2-1"), (last.Item.UnitNumber, last.Item.Lesson.Code));

        // Next on the last item: refused, and nothing moved
        Assert.Equal(HttpStatusCode.BadRequest, (await api.MoveAsync(roomId, "next")).StatusCode);
        var still = await StateAsync(roomId);
        Assert.Equal((3, 3), (still.Position, still.Revision));

        var back = await MoveAsync(roomId, "previous");
        Assert.Equal((2, true, true), (back.Position, back.CanGoPrevious, back.CanGoNext));
    }

    [Fact]
    public async Task Only_the_presenting_teacher_moves_the_board_or_decides_who_joins()
    {
        var roomId = await api.OpenRoomWithAsync(StudentUid);
        (await api.RequestToJoinAsync(ClassmateUid, roomId)).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.Forbidden, (await api.MoveAsync(roomId, "next", StudentUid)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await api.MoveAsync(roomId, "next", OtherTeacherUid)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await api.DecideAsync(roomId, ClassmateUid, "approve", OtherTeacherUid)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await api.DecideAsync(roomId, ClassmateUid, "approve", StudentUid)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await api.ClientFor(OtherTeacherUid).DeleteAsync($"/api/teaching-rooms/{roomId}")).StatusCode);

        Assert.Equal(1, (await StateAsync(roomId)).Position);
        var room = await api.ClientFor(TeacherUid).GetFromJsonAsync<RoomBody>($"/api/teaching-rooms/{roomId}", TeachingRoomApi.Json);
        Assert.Equal(TeachingRoomMemberStatus.Pending, room!.Room.Members!.Single(member => member.StudentId == api.School.UserId(ClassmateUid)).Status);
    }

    [Fact]
    public async Task Only_students_the_material_reaches_can_ask_to_join()
    {
        var roomId = await api.OpenRoomAsync();

        Assert.Equal(HttpStatusCode.Forbidden, (await api.RequestToJoinAsync(OutsiderUid, roomId)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await api.RequestToJoinAsync(ForeignStudentUid, roomId)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await api.ClientFor(TeacherUid).PostAsync($"/api/teaching-rooms/{roomId}/join-requests", null)).StatusCode);

        var asked = await (await api.RequestToJoinAsync(StudentUid, roomId)).Content.ReadFromJsonAsync<AdmissionBody>(TeachingRoomApi.Json);
        Assert.Equal(TeachingRoomAdmission.Pending, asked!.Admission);
        var again = await (await api.RequestToJoinAsync(StudentUid, roomId)).Content.ReadFromJsonAsync<AdmissionBody>(TeachingRoomApi.Json);
        Assert.Equal(TeachingRoomAdmission.Pending, again!.Admission);
    }

    [Fact]
    public async Task A_teacher_presents_only_material_they_uploaded()
    {
        var response = await api.ClientFor(OtherTeacherUid).PostAsJsonAsync("/api/teaching-rooms", new { teachingMaterialId = api.School.MaterialId });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await api.ClientFor(StudentUid).PostAsJsonAsync("/api/teaching-rooms", new { teachingMaterialId = api.School.MaterialId })).StatusCode);
    }

    [Fact]
    public async Task Each_lists_the_rooms_that_are_theirs()
    {
        var roomId = await api.OpenRoomAsync();

        Assert.Contains(await ListAsync(TeacherUid), room => room.Id == roomId && room.Admission == TeachingRoomAdmission.Teacher);
        Assert.Contains(await ListAsync(StudentUid), room => room.Id == roomId && room.Admission == TeachingRoomAdmission.MayRequest);
        Assert.DoesNotContain(await ListAsync(OutsiderUid), room => room.Id == roomId);
        Assert.DoesNotContain(await ListAsync(ForeignStudentUid), room => room.Id == roomId);
        Assert.DoesNotContain(await ListAsync(OtherTeacherUid), room => room.Id == roomId);
    }

    private async Task<TeachingRoomStateDto> StateAsync(int roomId)
        => (await api.ClientFor(TeacherUid).GetFromJsonAsync<StateBody>($"/api/teaching-rooms/{roomId}/state", TeachingRoomApi.Json))!.State;

    private async Task<TeachingRoomStateDto> MoveAsync(int roomId, string direction)
    {
        var response = await api.MoveAsync(roomId, direction);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<StateBody>(TeachingRoomApi.Json))!.State;
    }

    private async Task<IReadOnlyList<TeachingRoomSummaryDto>> ListAsync(string uid)
        => (await api.ClientFor(uid).GetFromJsonAsync<ListBody>("/api/teaching-rooms", TeachingRoomApi.Json))!.Rooms;

    private sealed record StateBody(TeachingRoomStateDto State);
    private sealed record RoomBody(TeachingRoomDto Room);
    private sealed record ListBody(IReadOnlyList<TeachingRoomSummaryDto> Rooms);
    private sealed record AdmissionBody(TeachingRoomAdmission Admission);
}
