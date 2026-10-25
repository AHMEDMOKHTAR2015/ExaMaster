namespace QuizMaster.Application.Features.Shared;

public static class TeacherRecords
{
    // A signed-in account's roster record: the one it is linked to, else the one with its email (as the app links them).
    public static async Task<Teacher?> FindTeacherRecordAsync(this QuizMasterDbContext dbContext, int userId, CancellationToken ct)
    {
        var account = await dbContext.Users.AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => new { user.TeacherId, user.Email })
            .SingleAsync(ct);

        if (account.TeacherId is { } teacherId
            && await dbContext.Teachers.AsNoTracking().SingleOrDefaultAsync(teacher => teacher.Id == teacherId, ct) is { } linked)
            return linked;

        return await dbContext.Teachers.AsNoTracking()
            .Where(teacher => teacher.Email == account.Email)
            .OrderBy(teacher => teacher.Id)
            .FirstOrDefaultAsync(ct);
    }
}
