namespace QuizMaster.Persistence.EntityConfigurations;

public class TenantEntityConfiguration : AuditedEntityConfiguration<Tenant>
{
    public override void Configure(EntityTypeBuilder<Tenant> builder)
    {
        base.Configure(builder);

        builder.HasIndex(e => e.Slug).IsUnique();

        builder.Property(e => e.Slug).HasMaxLength(Tenant.MaxSlugLength).IsRequired();
        builder.Property(e => e.Name).HasMaxLength(MaxLength.C128).IsRequired();
        builder.Property(e => e.Plan).HasEnumConversion().IsRequired();
        builder.Property(e => e.LogoUrl).HasMaxLength(MaxLength.C1024);
        builder.Property(e => e.PrimaryColor).HasMaxLength(MaxLength.C16);
    }
}
