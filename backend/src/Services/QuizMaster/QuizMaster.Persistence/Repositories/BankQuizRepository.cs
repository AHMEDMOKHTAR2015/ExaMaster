namespace QuizMaster.Persistence.Repositories;

public class BankQuizRepository(QuizMasterDbContext dbContext) : Repository<BankQuiz>(dbContext)
{
    // Query() defines the aggregate boundary: every GetByIdAsync loads the quiz WITH its question list.
    public override IQueryable<BankQuiz> Query() => base.Entity.Include(e => e.Questions);
}
