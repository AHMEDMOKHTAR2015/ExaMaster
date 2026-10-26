using QuizMaster.Application.Features.TeachingRooms.Shared;

namespace QuizMaster.Application.Features.TeachingRooms.ListTeachingRooms;

public class ListTeachingRoomsQueryHandler(QuizMasterDbContext _dbContext, IClaimsProvider _claimsProvider)
    : IRequestHandler<ListTeachingRoomsQuery, ListTeachingRoomsResponse>
{
    public async Task<ListTeachingRoomsResponse> Handle(ListTeachingRoomsQuery query, CancellationToken ct)
    {
        var caller = Caller.From(_claimsProvider);
        var callerId = caller.UserId;
        var rooms = _dbContext.TeachingRooms.AsNoTracking();

        if (caller.IsTeacher)
        {
            var mine = await Rows(rooms.Where(room => room.CreatedById == callerId), callerId).ToListAsync(ct);
            return new ListTeachingRoomsResponse(mine.Select(row => row.ToDto(TeachingRoomAdmission.Teacher)).ToList());
        }

        // candidates: rooms they asked to join, and rooms on a material of their grade; the material's own rule decides the rest
        var classGroup = await _dbContext.StudentClassAsync(callerId, ct);
        var gradeId = classGroup?.GradeId;
        var candidates = await Rows(rooms.Where(room => room.Members.Any(member => member.StudentId == callerId)
                || _dbContext.TeachingMaterials.Any(material => material.Id == room.TeachingMaterialId && material.GradeId == gradeId)), callerId)
            .ToListAsync(ct);

        var materialIds = candidates.Where(row => row.Status is null).Select(row => row.TeachingMaterialId).Distinct().ToList();
        var reaching = classGroup is null || materialIds.Count == 0
            ? []
            : (await _dbContext.TeachingMaterials.AsNoTracking().Where(material => materialIds.Contains(material.Id)).ToListAsync(ct))
                .Where(material => material.IsVisibleTo(classGroup))
                .Select(material => material.Id)
                .ToHashSet();

        var visible = candidates
            .Where(row => row.Status is not null || reaching.Contains(row.TeachingMaterialId))
            .Select(row => row.ToDto(row.Status is { } status ? TeachingRoomAdmissions.ForMember(status) : TeachingRoomAdmission.MayRequest))
            .ToList();

        return new ListTeachingRoomsResponse(visible);
    }

    private IQueryable<RoomRow> Rows(IQueryable<TeachingRoom> rooms, int callerId)
        => rooms.OrderByDescending(room => room.CreatedOn)
            .Select(room => new RoomRow(
                room.Id,
                room.SubjectId,
                room.TeachingMaterialId,
                _dbContext.TeachingMaterials.Where(material => material.Id == room.TeachingMaterialId).Select(material => material.Title).FirstOrDefault() ?? string.Empty,
                _dbContext.Users.Where(user => user.Id == room.CreatedById).Select(user => user.DisplayName).FirstOrDefault(),
                room.ItemCount,
                room.CreatedOn,
                room.Members.Where(member => member.StudentId == callerId).Select(member => (TeachingRoomMemberStatus?)member.Status).FirstOrDefault()));

    private sealed record RoomRow(
        int Id, int SubjectId, int TeachingMaterialId, string MaterialTitle, string? TeacherName, int ItemCount, DateTime CreatedOn,
        TeachingRoomMemberStatus? Status)
    {
        public TeachingRoomSummaryDto ToDto(TeachingRoomAdmission admission)
            => new(Id, SubjectId, TeachingMaterialId, MaterialTitle, TeacherName, ItemCount, CreatedOn, admission);
    }
}
