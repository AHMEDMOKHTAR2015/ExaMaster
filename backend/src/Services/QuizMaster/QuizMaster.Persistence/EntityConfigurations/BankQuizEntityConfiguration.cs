namespace QuizMaster.Persistence.EntityConfigurations;

public class BankQuizEntityConfiguration : TenantAggregateConfiguration<BankQuiz>
{
    public override void Configure(EntityTypeBuilder<BankQuiz> builder)
    {
        base.Configure(builder);

        builder.HasIndex(e => new { e.TenantId, e.StageId });

        builder.Property(e => e.Name).HasMaxLength(BankQuiz.MaxNameLength).IsRequired();
        builder.Property(e => e.Description).HasMaxLength(BankQuiz.MaxDescriptionLength).IsRequired();
        builder.Property(e => e.Semester).HasConversion<string>().HasMaxLength(MaxLength.C64);
        builder.ConfigureSettings();

        // Cleared by QuizMasterDbContext when the referenced row is deleted (SQL Server allows no second cascade path here).
        builder.HasOne<Subject>().WithMany().HasForeignKey(e => e.SubjectId).OnDelete(DeleteBehavior.ClientSetNull);
        builder.HasOne<Stage>().WithMany().HasForeignKey(e => e.StageId).OnDelete(DeleteBehavior.ClientSetNull);
        builder.HasOne<Grade>().WithMany().HasForeignKey(e => e.GradeId).OnDelete(DeleteBehavior.ClientSetNull);
        builder.HasOne<ClassGroup>().WithMany().HasForeignKey(e => e.ClassId).OnDelete(DeleteBehavior.ClientSetNull);
        builder.HasOne<User>().WithMany().HasForeignKey(e => e.ReviewerId).OnDelete(DeleteBehavior.ClientSetNull);   // users are never deleted

        builder.HasMany(e => e.Questions).WithOne()                          // children die with the aggregate
            .HasForeignKey(e => e.BankQuizId).IsRequired().OnDelete(DeleteBehavior.Cascade);
    }
}
