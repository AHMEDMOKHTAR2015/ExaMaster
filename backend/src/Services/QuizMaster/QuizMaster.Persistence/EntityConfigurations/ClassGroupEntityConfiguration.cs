namespace QuizMaster.Persistence.EntityConfigurations;

public class ClassGroupEntityConfiguration : TenantAggregateConfiguration<ClassGroup>
{
    public override void Configure(EntityTypeBuilder<ClassGroup> builder)
    {
        base.Configure(builder);

        builder.Property(e => e.Name).HasMaxLength(MaxLength.C128).IsRequired();
        builder.PrimitiveCollection(e => e.TeacherIds);
        builder.PrimitiveCollection(e => e.SubjectIds);

        builder.HasOne<Stage>().WithMany().HasForeignKey(e => e.StageId).IsRequired().OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Grade>().WithMany().HasForeignKey(e => e.GradeId).IsRequired().OnDelete(DeleteBehavior.Restrict);
    }
}
