namespace QuizMaster.Persistence.EntityConfigurations;

public class StageEntityConfiguration : TenantAggregateConfiguration<Stage>
{
    public override void Configure(EntityTypeBuilder<Stage> builder)
    {
        base.Configure(builder);

        builder.Property(e => e.Name).HasMaxLength(MaxLength.C128).IsRequired();
    }
}
