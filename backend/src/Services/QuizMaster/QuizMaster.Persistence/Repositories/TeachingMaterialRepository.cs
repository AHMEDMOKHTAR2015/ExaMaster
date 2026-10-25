namespace QuizMaster.Persistence.Repositories;

public class TeachingMaterialRepository(QuizMasterDbContext dbContext) : Repository<TeachingMaterial>(dbContext)
{
    //insight - a material is a few hundred lessons of JSON: one query per level beats one row per lesson × unit
    public override IQueryable<TeachingMaterial> Query()
        => base.Entity.Include(e => e.Units).ThenInclude(unit => unit.Lessons).AsSplitQuery();
}
