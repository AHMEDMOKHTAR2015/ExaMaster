using QuizMaster.Application.Features.TeachingRooms.Shared;

namespace QuizMaster.Application.Features.TeachingRooms.GetTeachingRoom;

public class GetTeachingRoomQueryHandler(QuizMasterDbContext _dbContext, IClaimsProvider _claimsProvider)
    : IRequestHandler<GetTeachingRoomQuery, GetTeachingRoomResponse>
{
    public async Task<GetTeachingRoomResponse> Handle(GetTeachingRoomQuery query, CancellationToken ct)
    {
        var caller = Caller.From(_claimsProvider);
        var admission = await _dbContext.AdmissionAsync(query.Id, caller.UserId, caller.Roles, ct);
        if (admission == TeachingRoomAdmission.None)
            throw new ForbiddenException("This teaching room is not for you.");

        var room = await _dbContext.TeachingRooms.AsNoTracking()
            .Where(room => room.Id == query.Id)
            .Select(room => new
            {
                room.Id,
                room.SubjectId,
                room.TeachingMaterialId,
                MaterialTitle = _dbContext.TeachingMaterials.Where(material => material.Id == room.TeachingMaterialId).Select(material => material.Title).FirstOrDefault() ?? string.Empty,
                TeacherName = _dbContext.Users.Where(user => user.Id == room.CreatedById).Select(user => user.DisplayName).FirstOrDefault(),
                room.ItemCount,
                room.CreatedOn
            })
            .SingleOrDefaultAsync(ct)
            ?? throw new NotFoundException("Teaching room not found.");

        var members = admission == TeachingRoomAdmission.Teacher ? await MembersAsync(query.Id, ct) : null;

        return new GetTeachingRoomResponse(new TeachingRoomDto(
            room.Id, room.SubjectId, room.TeachingMaterialId, room.MaterialTitle, room.TeacherName, room.ItemCount, room.CreatedOn, admission, members));
    }

    // waiting students first, so the teacher sees who is at the door; then everyone else in the order they asked
    private async Task<IReadOnlyList<TeachingRoomMemberDto>> MembersAsync(int roomId, CancellationToken ct)
    {
        var members = await _dbContext.TeachingRooms.AsNoTracking()
            .Where(room => room.Id == roomId)
            .SelectMany(room => room.Members)
            .Select(member => new
            {
                member.StudentId,
                member.Status,
                member.RequestedOn,
                member.DecidedOn,
                Student = _dbContext.Users.Where(user => user.Id == member.StudentId).Select(user => new { user.DisplayName, user.ClassId }).FirstOrDefault()
            })
            .ToListAsync(ct);

        var classIds = members.Where(member => member.Student?.ClassId != null).Select(member => member.Student!.ClassId!.Value).Distinct().ToList();
        var classNames = await _dbContext.Classes.AsNoTracking().Where(classGroup => classIds.Contains(classGroup.Id))
            .ToDictionaryAsync(classGroup => classGroup.Id, classGroup => classGroup.Name, ct);

        return members
            .OrderBy(member => member.Status == TeachingRoomMemberStatus.Pending ? 0 : 1)
            .ThenBy(member => member.RequestedOn)
            .Select(member => new TeachingRoomMemberDto(
                member.StudentId,
                member.Student?.DisplayName ?? string.Empty,
                member.Student?.ClassId is { } classId ? classNames.GetValueOrDefault(classId) : null,
                member.Status,
                member.RequestedOn,
                member.DecidedOn))
            .ToList();
    }
}
