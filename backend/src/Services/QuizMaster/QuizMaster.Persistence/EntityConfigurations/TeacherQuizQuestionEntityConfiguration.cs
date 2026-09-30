namespace QuizMaster.Persistence.EntityConfigurations;

public class TeacherQuizQuestionEntityConfiguration : EntityConfiguration<TeacherQuizQuestion>
{
    public override void Configure(EntityTypeBuilder<TeacherQuizQuestion> builder)
    {
        base.Configure(builder);

        builder.HasIndex(e => new { e.TeacherQuizId, e.Number }).IsUnique();

        builder.ConfigureQuestionContent();
    }
}
