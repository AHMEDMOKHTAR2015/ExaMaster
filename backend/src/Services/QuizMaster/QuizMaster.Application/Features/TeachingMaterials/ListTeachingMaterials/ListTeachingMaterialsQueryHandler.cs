namespace QuizMaster.Application.Features.TeachingMaterials.ListTeachingMaterials;

public class ListTeachingMaterialsQueryHandler(TeachingMaterialRepository _teachingMaterialRepository, IClaimsProvider _claimsProvider, QuizMasterDbContext _dbContext)
    : IRequestHandler<ListTeachingMaterialsQuery, ListTeachingMaterialsResponse>
{
    public async Task<ListTeachingMaterialsResponse> Handle(ListTeachingMaterialsQuery query, CancellationToken ct)
    {
        var caller = Caller.From(_claimsProvider);
        var materials = _teachingMaterialRepository.QueryNotTracked();

        if (!caller.IsApplicationAdmin)
            materials = materials.Where(material => material.CreatedById == caller.UserId);
        if (query.SubjectId is { } subjectId)
            materials = materials.Where(material => material.SubjectId == subjectId);
        if (query.GradeId is { } gradeId)
            materials = materials.Where(material => material.GradeId == gradeId);

        // counted by the database: a list never loads the lessons (or the overview) themselves
        var rows = await materials.OrderByDescending(material => material.CreatedOn)
            .Select(material => new TeachingMaterialSummaryDto(
                material.Id,
                material.SourceKey,
                material.Title,
                material.Subtitle,
                material.SubjectId,
                material.GradeId,
                material.Semester,
                material.Units.Count,
                material.Units.SelectMany(unit => unit.Lessons).Count(),
                material.CreatedById,
                _dbContext.Users.Where(user => user.Id == material.CreatedById).Select(user => user.DisplayName).FirstOrDefault(),
                material.CreatedOn))
            .ToListAsync(ct);

        return new ListTeachingMaterialsResponse(rows);
    }
}
