namespace QuizMaster.Persistence.Repositories;

public class TeachingMaterialRepository(QuizMasterDbContext dbContext) : Repository<TeachingMaterial>(dbContext)
{
    //insight - a material is a few hundred lessons of JSON: one query per level beats one row per lesson × unit
    public override IQueryable<TeachingMaterial> Query()
        => base.Entity.Include(e => e.Units).ThenInclude(unit => unit.Lessons).AsSplitQuery();

    // One lesson by its place in reading order (units by number, lessons by order; 1-based), with its unit: what a teaching
    // room shows. Reached through the material, so the tenant filter applies; null when there is no such place.
    public async Task<MaterialStop?> GetLessonAtAsync(int materialId, int position, CancellationToken ct = default)
    {
        if (position < 1)
            return null;

        var stop = await base.Entity.AsNoTracking()
            .Where(material => material.Id == materialId)
            .SelectMany(material => material.Units)
            .SelectMany(unit => unit.Lessons, (unit, lesson) => new { Unit = unit, Lesson = lesson, LessonsInUnit = unit.Lessons.Count })
            .OrderBy(row => row.Unit.Number).ThenBy(row => row.Lesson.Order)
            .Skip(position - 1)
            .FirstOrDefaultAsync(ct);

        return stop is null ? null : new MaterialStop(stop.Unit, stop.Lesson, stop.LessonsInUnit);
    }
}

// A lesson with the unit it belongs to, and how many lessons that unit has (the last one closes the unit).
public sealed record MaterialStop(MaterialUnit Unit, MaterialLesson Lesson, int LessonsInUnit)
{
    public bool ClosesUnit => Lesson.Order == LessonsInUnit;
}
