namespace QuizMaster.Persistence.EntityConfigurations;

public class HomeworkAssignmentEntityConfiguration : TenantAggregateConfiguration<HomeworkAssignment>
{
    public override void Configure(EntityTypeBuilder<HomeworkAssignment> builder)
    {
        base.Configure(builder);

        // A student's list is loaded by class and by stage; a teacher's by author.
        builder.HasIndex(e => new { e.TenantId, e.ClassId, e.IsActive });
        builder.HasIndex(e => new { e.TenantId, e.StageId, e.IsActive });
        builder.HasIndex(e => new { e.TenantId, e.CreatedById });

        builder.Property(e => e.Title).HasMaxLength(HomeworkAssignment.MaxTitleLength).IsRequired();
        builder.Property(e => e.Kind).HasEnumConversion().IsRequired();
        builder.Property(e => e.Source).HasEnumConversion().IsRequired();
        builder.Property(e => e.Semester).HasConversion<string>().HasMaxLength(MaxLength.C64);
        builder.PrimitiveCollection(e => e.AssignedChildIds);

        // An assigned quiz cannot be deleted out from under its students (the delete handlers explain why).
        builder.HasOne<BankQuiz>().WithMany().HasForeignKey(e => e.BankQuizId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<TeacherQuiz>().WithMany().HasForeignKey(e => e.TeacherQuizId).OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Stage>().WithMany().HasForeignKey(e => e.StageId).IsRequired().OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<ClassGroup>().WithMany().HasForeignKey(e => e.ClassId).IsRequired().OnDelete(DeleteBehavior.Restrict);
        // Cleared by QuizMasterDbContext when the referenced row is deleted (SQL Server allows no second cascade path here).
        builder.HasOne<Grade>().WithMany().HasForeignKey(e => e.GradeId).OnDelete(DeleteBehavior.ClientSetNull);
        builder.HasOne<Subject>().WithMany().HasForeignKey(e => e.SubjectId).OnDelete(DeleteBehavior.ClientSetNull);
    }
}
