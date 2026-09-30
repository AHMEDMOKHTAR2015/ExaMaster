namespace QuizMaster.Persistence.EntityConfigurations;

public class QuestionEntityConfiguration : TenantAggregateConfiguration<Question>
{
    public override void Configure(EntityTypeBuilder<Question> builder)
    {
        base.Configure(builder);

        builder.HasIndex(e => new { e.TenantId, e.SubjectId, e.StageId });

        builder.ConfigureQuestionContent();

        builder.Property(e => e.Semester).HasConversion<string>().HasMaxLength(MaxLength.C64);

        // Cleared by QuizMasterDbContext when the referenced row is deleted (SQL Server allows no second cascade path here).
        builder.HasOne<Subject>().WithMany().HasForeignKey(e => e.SubjectId).OnDelete(DeleteBehavior.ClientSetNull);
        builder.HasOne<Stage>().WithMany().HasForeignKey(e => e.StageId).OnDelete(DeleteBehavior.ClientSetNull);
        builder.HasOne<Grade>().WithMany().HasForeignKey(e => e.GradeId).OnDelete(DeleteBehavior.ClientSetNull);
    }
}
