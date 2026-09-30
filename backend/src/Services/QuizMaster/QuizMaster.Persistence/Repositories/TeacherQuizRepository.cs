namespace QuizMaster.Persistence.Repositories;

public class TeacherQuizRepository(QuizMasterDbContext dbContext) : Repository<TeacherQuiz>(dbContext)
{
    public override IQueryable<TeacherQuiz> Query() => base.Entity.Include(e => e.Questions);
}
