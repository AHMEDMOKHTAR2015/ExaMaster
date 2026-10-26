namespace QuizMaster.Persistence.Repositories;

public class TeachingRoomRepository(QuizMasterDbContext dbContext) : Repository<TeachingRoom>(dbContext)
{
    // A room is loaded whole: its members are what its teacher decides on.
    public override IQueryable<TeachingRoom> Query()
        => base.Entity.Include(e => e.Members);
}
