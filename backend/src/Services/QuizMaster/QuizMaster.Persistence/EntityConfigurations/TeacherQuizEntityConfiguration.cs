namespace QuizMaster.Persistence.EntityConfigurations;

public class TeacherQuizEntityConfiguration : TenantAggregateConfiguration<TeacherQuiz>
{
    public override void Configure(EntityTypeBuilder<TeacherQuiz> builder)
    {
        base.Configure(builder);

        builder.HasIndex(e => new { e.TenantId, e.CreatedById });

        builder.Property(e => e.Name).HasMaxLength(TeacherQuiz.MaxNameLength).IsRequired();
        builder.Property(e => e.Description).HasMaxLength(TeacherQuiz.MaxDescriptionLength).IsRequired();
        builder.Property(e => e.Semester).HasConversion<string>().HasMaxLength(MaxLength.C64);
        builder.ConfigureSettings();

        builder.HasOne<Subject>().WithMany().HasForeignKey(e => e.SubjectId).IsRequired().OnDelete(DeleteBehavior.Restrict);
        // Cleared by QuizMasterDbContext when the referenced row is deleted (SQL Server allows no second cascade path here).
        builder.HasOne<Stage>().WithMany().HasForeignKey(e => e.StageId).OnDelete(DeleteBehavior.ClientSetNull);

        builder.HasMany(e => e.Questions).WithOne()
            .HasForeignKey(e => e.TeacherQuizId).IsRequired().OnDelete(DeleteBehavior.Cascade);
    }
}
