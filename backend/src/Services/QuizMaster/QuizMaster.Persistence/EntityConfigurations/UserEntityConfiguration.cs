namespace QuizMaster.Persistence.EntityConfigurations;

public class UserEntityConfiguration : TenantAggregateConfiguration<User>
{
    public override void Configure(EntityTypeBuilder<User> builder)
    {
        base.Configure(builder);

        // Sign-in is one pool across every organization, so the uid is unique platform-wide.
        builder.HasIndex(e => e.SignInUid).IsUnique();
        builder.HasIndex(e => new { e.TenantId, e.ClassId });
        builder.HasIndex(e => new { e.TenantId, e.ParentId });

        // Compared exactly (binary collation): a uid is an identifier, not text, so case is never folded.
        builder.Property(e => e.SignInUid).HasMaxLength(MaxLength.C128).UseCollation("Latin1_General_100_BIN2").IsRequired();
        builder.Property(e => e.Email).HasMaxLength(MaxLength.C256).IsRequired();
        builder.Property(e => e.DisplayName).HasMaxLength(MaxLength.C256).IsRequired();
        builder.Property(e => e.FirstName).HasMaxLength(MaxLength.C128);
        builder.Property(e => e.LastName).HasMaxLength(MaxLength.C128);
        builder.Property(e => e.MobileNumber).HasMaxLength(MaxLength.C32);
        builder.Property(e => e.PhotoUrl).HasMaxLength(MaxLength.C1024);

        // a JSON array of role names: queryable through OPENJSON ("every teacher of this tenant") and readable in the database
        builder.PrimitiveCollection(e => e.Roles).ElementType().HasConversion<string>();

        builder.HasOne<User>().WithMany().HasForeignKey(e => e.ParentId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Teacher>().WithMany().HasForeignKey(e => e.TeacherId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<Stage>().WithMany().HasForeignKey(e => e.StageId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<Grade>().WithMany().HasForeignKey(e => e.GradeId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<ClassGroup>().WithMany().HasForeignKey(e => e.ClassId).OnDelete(DeleteBehavior.SetNull);
        // A key that admitted accounts cannot be deleted from under them (it would lock them out); deactivate it instead.
        builder.HasOne<RegistrationKey>().WithMany().HasForeignKey(e => e.RegistrationKeyId).OnDelete(DeleteBehavior.Restrict);
    }
}
