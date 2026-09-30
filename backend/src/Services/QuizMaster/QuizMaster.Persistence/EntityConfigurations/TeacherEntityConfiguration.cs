namespace QuizMaster.Persistence.EntityConfigurations;

public class TeacherEntityConfiguration : TenantAggregateConfiguration<Teacher>
{
    public override void Configure(EntityTypeBuilder<Teacher> builder)
    {
        base.Configure(builder);

        builder.Property(e => e.FirstName).HasMaxLength(MaxLength.C128).IsRequired();
        builder.Property(e => e.LastName).HasMaxLength(MaxLength.C128).IsRequired();
        builder.Property(e => e.Email).HasMaxLength(MaxLength.C256);
        builder.Property(e => e.PhotoUrl).HasMaxLength(MaxLength.C1024);
        builder.PrimitiveCollection(e => e.SubjectIds);
    }
}
