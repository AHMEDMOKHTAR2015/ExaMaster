namespace QuizMaster.Persistence.EntityConfigurations;

public class RegistrationKeyEntityConfiguration : TenantAggregateConfiguration<RegistrationKey>
{
    // rowversion: two children enrolled at once on one family's key race on ChildCount instead of both taking the last slot.
    protected override bool HasConcurrencyToken => true;

    public override void Configure(EntityTypeBuilder<RegistrationKey> builder)
    {
        base.Configure(builder);

        //insight - unique platform-wide, not per tenant: registration looks the code up before the caller has a tenant
        builder.HasIndex(e => e.Code).IsUnique();
        builder.HasIndex(e => new { e.TenantId, e.ParentId });

        builder.Property(e => e.Code).HasMaxLength(MaxLength.C64).IsRequired();
        builder.Property(e => e.Role).HasEnumConversion().IsRequired();

        builder.HasOne<User>().WithMany().HasForeignKey(e => e.ParentId).OnDelete(DeleteBehavior.Restrict);
    }
}
