namespace QuizMaster.Persistence.EntityConfigurations;

public class GradeEntityConfiguration : TenantAggregateConfiguration<Grade>
{
    public override void Configure(EntityTypeBuilder<Grade> builder)
    {
        base.Configure(builder);

        builder.Property(e => e.Name).HasMaxLength(MaxLength.C128).IsRequired();

        builder.HasOne<Stage>().WithMany().HasForeignKey(e => e.StageId).IsRequired().OnDelete(DeleteBehavior.Restrict);
    }
}
