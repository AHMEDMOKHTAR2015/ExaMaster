namespace QuizMaster.Persistence.EntityConfigurations;

public class QuizAttemptLockEntityConfiguration : TenantAggregateConfiguration<QuizAttemptLock>
{
    // rowversion: a student's exit and a teacher's release can race; neither may silently overwrite the other.
    protected override bool HasConcurrencyToken => true;

    public override void Configure(EntityTypeBuilder<QuizAttemptLock> builder)
    {
        base.Configure(builder);

        //insight - one lock per student per scope: two tabs racing to open the same attempt cannot both succeed
        builder.HasIndex(e => new { e.TenantId, e.ChildId, e.ScopeKey }).IsUnique();
        builder.HasIndex(e => new { e.TenantId, e.HomeworkId });

        builder.Property(e => e.ScopeKey).HasMaxLength(MaxLength.C64).IsRequired();
        builder.Property(e => e.QuizName).HasMaxLength(MaxLength.C256).IsRequired();
        builder.Property(e => e.Status).HasEnumConversion().IsRequired();
        builder.Property(e => e.LastExitReason).HasConversion<string>().HasMaxLength(MaxLength.C64);

        builder.HasOne<User>().WithMany().HasForeignKey(e => e.ChildId).IsRequired().OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<HomeworkAssignment>().WithMany().HasForeignKey(e => e.HomeworkId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<BankQuiz>().WithMany().HasForeignKey(e => e.BankQuizId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<TeacherQuiz>().WithMany().HasForeignKey(e => e.TeacherQuizId).OnDelete(DeleteBehavior.SetNull);
    }
}
