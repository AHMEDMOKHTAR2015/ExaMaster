namespace QuizMaster.Persistence.EntityConfigurations;

public class ParticipationEntityConfiguration : TenantAggregateConfiguration<Participation>
{
    // rowversion: a teacher's review never silently overwrites a concurrent one.
    protected override bool HasConcurrencyToken => true;

    public override void Configure(EntityTypeBuilder<Participation> builder)
    {
        base.Configure(builder);

        builder.HasIndex(e => new { e.TenantId, e.ChildId, e.EndedOn });               // a student's history
        builder.HasIndex(e => new { e.TenantId, e.HomeworkId });                       // an assignment's submissions
        builder.HasIndex(e => new { e.TenantId, e.ReviewerId, e.PendingReviewCount }); // a teacher's review queue

        //insight - these two make a double submission impossible, not just unlikely: the same attempt sent twice carries
        // the same key, and two attempts at one assignment racing past the "already submitted" check claim the same number
        builder.HasIndex(e => new { e.TenantId, e.ChildId, e.SubmissionKey }).IsUnique()
            .HasFilter($"[{nameof(Participation.SubmissionKey)}] IS NOT NULL");
        builder.HasIndex(e => new { e.TenantId, e.ChildId, e.HomeworkId, e.HomeworkAttempt }).IsUnique()
            .HasFilter($"[{nameof(Participation.HomeworkId)}] IS NOT NULL");

        builder.Property(e => e.Type).HasEnumConversion().IsRequired();
        builder.Property(e => e.QuizName).HasMaxLength(MaxLength.C256).IsRequired();
        builder.Property(e => e.HomeworkTitle).HasMaxLength(MaxLength.C256);
        builder.Property(e => e.ValidationStatus).HasConversion<string>().HasMaxLength(MaxLength.C64);
        builder.Property(e => e.ValidationFeedback).HasMaxLength(Participation.MaxFeedbackLength);

        builder.HasOne<User>().WithMany().HasForeignKey(e => e.ChildId).IsRequired().OnDelete(DeleteBehavior.Restrict);
        // Users are deactivated, never deleted; SQL Server allows only one SET NULL path from user into this table.
        builder.HasOne<User>().WithMany().HasForeignKey(e => e.ParentId).OnDelete(DeleteBehavior.ClientSetNull);
        builder.HasOne<User>().WithMany().HasForeignKey(e => e.ReviewerId).OnDelete(DeleteBehavior.ClientSetNull);

        // The record outlives the quiz and the assignment: their names are snapshotted onto it.
        builder.HasOne<BankQuiz>().WithMany().HasForeignKey(e => e.BankQuizId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<TeacherQuiz>().WithMany().HasForeignKey(e => e.TeacherQuizId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<HomeworkAssignment>().WithMany().HasForeignKey(e => e.HomeworkId).OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(e => e.Answers).WithOne()                             // children die with the aggregate
            .HasForeignKey(e => e.ParticipationId).IsRequired().OnDelete(DeleteBehavior.Cascade);
    }
}
