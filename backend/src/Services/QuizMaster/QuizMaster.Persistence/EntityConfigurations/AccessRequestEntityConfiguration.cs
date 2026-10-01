namespace QuizMaster.Persistence.EntityConfigurations;

// Platform-wide, like Tenant: a request belongs to no organization until it is approved, so it carries no tenant filter.
public class AccessRequestEntityConfiguration : AuditedEntityConfiguration<AccessRequest>
{
    // rowversion: two reviewers deciding one request at once race on it instead of both creating an account.
    protected override bool HasConcurrencyToken => true;

    public override void Configure(EntityTypeBuilder<AccessRequest> builder)
    {
        base.Configure(builder);

        //insight - one pending request per sign-in: a second one would be a duplicate for the reviewer, and approving both
        // would collide on the sign-in anyway. A decided request no longer counts, so someone turned down can ask again.
        builder.HasIndex(e => e.SignInEmail).IsUnique().HasFilter($"[{nameof(AccessRequest.Status)}] = '{nameof(AccessRequestStatus.Pending)}'");
        builder.HasIndex(e => new { e.Status, e.CreatedOn });

        builder.Property(e => e.Kind).HasEnumConversion().IsRequired();
        builder.Property(e => e.Status).HasEnumConversion().IsRequired();
        builder.Property(e => e.FirstName).HasMaxLength(MaxLength.C128).IsRequired();
        builder.Property(e => e.LastName).HasMaxLength(MaxLength.C128).IsRequired();
        builder.Property(e => e.MobileNumber).HasMaxLength(MaxLength.C32).IsRequired();
        builder.Property(e => e.SignInEmail).HasMaxLength(MaxLength.C256).IsRequired();
        builder.Property(e => e.PasswordHash).HasMaxLength(MaxLength.C256).IsRequired();
        builder.Property(e => e.ContactEmail).HasMaxLength(MaxLength.C256);
        builder.Property(e => e.SchoolName).HasMaxLength(MaxLength.C128).IsRequired();
        builder.Property(e => e.GradeName).HasMaxLength(MaxLength.C128);
        builder.Property(e => e.ParentName).HasMaxLength(MaxLength.C256);
        builder.Property(e => e.ParentMobileNumber).HasMaxLength(MaxLength.C32);
        builder.Property(e => e.Note).HasMaxLength(MaxLength.C1024);
        builder.Property(e => e.RejectionReason).HasMaxLength(MaxLength.C1024);

        builder.HasOne<Tenant>().WithMany().HasForeignKey(e => e.ApprovedTenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(e => e.ApprovedUserId).OnDelete(DeleteBehavior.SetNull);
    }
}
