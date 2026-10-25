namespace QuizMaster.Persistence.EntityConfigurations;

public class MaterialLessonEntityConfiguration : EntityConfiguration<MaterialLesson>
{
    public override void Configure(EntityTypeBuilder<MaterialLesson> builder)
    {
        base.Configure(builder);

        builder.HasIndex(e => new { e.MaterialUnitId, e.Order }).IsUnique();

        builder.Property(e => e.Code).HasMaxLength(TeachingMaterial.MaxLessonCodeLength).IsRequired();
        builder.Property(e => e.Title).HasMaxLength(TeachingMaterial.MaxLessonTitleLength).IsRequired();
        builder.Property(e => e.ContentJson).IsRequired();
        builder.Property(e => e.ArabicExplanationJson).IsRequired();
    }
}
