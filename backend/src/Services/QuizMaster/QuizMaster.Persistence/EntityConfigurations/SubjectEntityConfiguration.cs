namespace QuizMaster.Persistence.EntityConfigurations;

public class SubjectEntityConfiguration : TenantAggregateConfiguration<Subject>
{
    public override void Configure(EntityTypeBuilder<Subject> builder)
    {
        base.Configure(builder);

        builder.Property(e => e.Name).HasMaxLength(MaxLength.C128).IsRequired();
        builder.Property(e => e.Color).HasMaxLength(MaxLength.C16);
    }
}
