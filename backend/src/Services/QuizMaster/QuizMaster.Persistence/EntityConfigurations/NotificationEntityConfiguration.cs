namespace QuizMaster.Persistence.EntityConfigurations;

public class NotificationEntityConfiguration : TenantAggregateConfiguration<Notification>
{
    public override void Configure(EntityTypeBuilder<Notification> builder)
    {
        base.Configure(builder);

        // the inbox query: one recipient, newest first
        builder.HasIndex(e => new { e.TenantId, e.RecipientId, e.CreatedOn });

        builder.Property(e => e.Type).HasEnumConversion().IsRequired();
        builder.Property(e => e.Title).HasMaxLength(MaxLength.C256).IsRequired();
        builder.Property(e => e.ChildName).HasMaxLength(MaxLength.C256).IsRequired();
        builder.Property(e => e.Feedback).HasMaxLength(MaxLength.C2048);

        builder.HasOne<User>().WithMany().HasForeignKey(e => e.RecipientId).IsRequired().OnDelete(DeleteBehavior.Restrict);
        // a deleted submission takes its announcements with it: they would point at nothing
        builder.HasOne<Participation>().WithMany().HasForeignKey(e => e.ParticipationId).IsRequired().OnDelete(DeleteBehavior.Cascade);
    }
}
