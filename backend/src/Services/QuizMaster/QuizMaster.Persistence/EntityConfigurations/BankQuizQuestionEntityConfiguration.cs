namespace QuizMaster.Persistence.EntityConfigurations;

public class BankQuizQuestionEntityConfiguration : EntityConfiguration<BankQuizQuestion>
{
    public override void Configure(EntityTypeBuilder<BankQuizQuestion> builder)
    {
        base.Configure(builder);

        builder.HasIndex(e => new { e.BankQuizId, e.Position }).IsUnique();

        // A bank question deleted later simply drops out of the quizzes that used it (they skip missing questions).
        builder.HasOne<Question>().WithMany().HasForeignKey(e => e.QuestionId).IsRequired().OnDelete(DeleteBehavior.Cascade);
    }
}
