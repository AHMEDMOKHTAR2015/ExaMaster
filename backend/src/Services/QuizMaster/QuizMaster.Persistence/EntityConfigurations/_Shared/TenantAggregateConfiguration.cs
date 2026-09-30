namespace QuizMaster.Persistence.EntityConfigurations.Shared;

// Every aggregate owned by a tenant: the tenant column is required and leads its indexes.
public abstract class TenantAggregateConfiguration<T> : AuditedEntityConfiguration<T>
    where T : class, IAggregateRoot, IMultitenancy
{
    public override void Configure(EntityTypeBuilder<T> builder)
    {
        base.Configure(builder);

        builder.Property(e => e.TenantId).IsRequired();
        builder.HasIndex(e => e.TenantId);
    }
}
