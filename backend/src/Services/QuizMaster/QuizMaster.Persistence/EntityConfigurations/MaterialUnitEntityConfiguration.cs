namespace QuizMaster.Persistence.EntityConfigurations;

public class MaterialUnitEntityConfiguration : EntityConfiguration<MaterialUnit>
{
    public override void Configure(EntityTypeBuilder<MaterialUnit> builder)
    {
        base.Configure(builder);

        builder.HasIndex(e => new { e.TeachingMaterialId, e.Number }).IsUnique();

        builder.Property(e => e.Kind).HasMaxLength(TeachingMaterial.MaxUnitKindLength).IsRequired();
        builder.Property(e => e.Title).HasMaxLength(TeachingMaterial.MaxUnitTitleLength).IsRequired();
        builder.Property(e => e.BigIdeaEnglish).IsRequired();
        builder.Property(e => e.BigIdeaArabic).IsRequired();
        builder.PrimitiveCollection(e => e.KeyTakeaways);

        builder.HasMany(e => e.Lessons).WithOne()
            .HasForeignKey(e => e.MaterialUnitId).IsRequired().OnDelete(DeleteBehavior.Cascade);
    }
}
