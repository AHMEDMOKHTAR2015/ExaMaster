namespace QuizMaster.Application.Features.TeachingRooms.Shared;

// Where a caller stands in a teaching room: the one rule behind QuizMasterAccessChecker, every room handler and the hub.
// Read from the database every time, never from anything the client sends.
public static class TeachingRoomAdmissions
{
    public static bool IsAdmitted(this TeachingRoomAdmission admission)
        => admission is TeachingRoomAdmission.Teacher or TeachingRoomAdmission.Approved;

    public static async Task<TeachingRoomAdmission> AdmissionAsync(
        this QuizMasterDbContext dbContext, int roomId, int userId, IReadOnlySet<UserRoleType> roles, CancellationToken ct)
    {
        // the tenant filter applies: another organization's room is no room at all
        var room = await dbContext.TeachingRooms.AsNoTracking()
            .Where(room => room.Id == roomId)
            .Select(room => new
            {
                room.CreatedById,
                room.TeachingMaterialId,
                Status = room.Members.Where(member => member.StudentId == userId).Select(member => (TeachingRoomMemberStatus?)member.Status).FirstOrDefault()
            })
            .SingleOrDefaultAsync(ct);

        if (room is null)
            return TeachingRoomAdmission.None;
        if (roles.Contains(UserRoleType.TEACHER))
            return room.CreatedById == userId ? TeachingRoomAdmission.Teacher : TeachingRoomAdmission.None;
        if (!roles.Contains(UserRoleType.STUDENT))
            return TeachingRoomAdmission.None;

        if (room.Status is { } status)
            return ForMember(status);
        return await dbContext.MaterialReachesStudentAsync(room.TeachingMaterialId, userId, ct)
            ? TeachingRoomAdmission.MayRequest
            : TeachingRoomAdmission.None;
    }

    public static TeachingRoomAdmission ForMember(TeachingRoomMemberStatus status) => status switch
    {
        TeachingRoomMemberStatus.Approved => TeachingRoomAdmission.Approved,
        TeachingRoomMemberStatus.Pending => TeachingRoomAdmission.Pending,
        _ => TeachingRoomAdmission.Rejected
    };

    //insight - who may ask to join is who the material is for (TeachingMaterial.IsVisibleTo): a class of its grade that
    // studies its subject and is taught by its uploader. Checked in memory, so the rule stays in one place in the domain
    public static async Task<bool> MaterialReachesStudentAsync(this QuizMasterDbContext dbContext, int materialId, int studentId, CancellationToken ct)
    {
        var classGroup = await dbContext.StudentClassAsync(studentId, ct);
        if (classGroup is null)
            return false;

        var material = await dbContext.TeachingMaterials.AsNoTracking().SingleOrDefaultAsync(material => material.Id == materialId, ct);
        return material?.IsVisibleTo(classGroup) == true;
    }

    // An active student's class; null for anyone else, and for a student not placed in a class yet.
    public static async Task<ClassGroup?> StudentClassAsync(this QuizMasterDbContext dbContext, int studentId, CancellationToken ct)
    {
        var classId = await dbContext.Users.AsNoTracking()
            .Where(user => user.Id == studentId && user.IsActive && user.Roles.Contains(UserRoleType.STUDENT))
            .Select(user => user.ClassId)
            .SingleOrDefaultAsync(ct);

        return classId is { } id
            ? await dbContext.Classes.AsNoTracking().SingleOrDefaultAsync(classGroup => classGroup.Id == id, ct)
            : null;
    }
}
