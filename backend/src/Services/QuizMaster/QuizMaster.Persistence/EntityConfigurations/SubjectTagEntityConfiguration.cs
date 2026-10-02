namespace QuizMaster.Persistence.EntityConfigurations;

public class SubjectTagEntityConfiguration : EntityConfiguration<SubjectTag>
{
    public override void Configure(EntityTypeBuilder<SubjectTag> builder)
    {
        base.Configure(builder);

        // the default collation is case-insensitive, as is the domain's uniqueness rule
        builder.HasIndex(e => new { e.SubjectId, e.Name }).IsUnique();

        builder.Property(e => e.Name).HasMaxLength(Subject.MaxTagNameLength).IsRequired();
    }
}
