namespace QuizMaster.Persistence.EntityConfigurations;

public class TeachingMaterialEntityConfiguration : TenantAggregateConfiguration<TeachingMaterial>
{
    public override void Configure(EntityTypeBuilder<TeachingMaterial> builder)
    {
        base.Configure(builder);

        // the same document twice from one teacher for one subject and grade is a duplicate (409)
        builder.HasIndex(e => new { e.TenantId, e.CreatedById, e.SubjectId, e.GradeId, e.SourceKey }).IsUnique();
        builder.HasIndex(e => new { e.TenantId, e.TeacherId });

        builder.Property(e => e.SourceKey).HasMaxLength(TeachingMaterial.MaxSourceKeyLength).IsRequired();
        builder.Property(e => e.Title).HasMaxLength(TeachingMaterial.MaxTitleLength).IsRequired();
        builder.Property(e => e.Subtitle).HasMaxLength(TeachingMaterial.MaxSubtitleLength);
        builder.Property(e => e.ForLabel).HasMaxLength(TeachingMaterial.MaxForLabelLength);
        builder.Property(e => e.Semester).HasConversion<string>().HasMaxLength(MaxLength.C64);
        builder.Property(e => e.OverviewJson).IsRequired();

        // A subject or grade that still has material cannot be deleted (409): the material would lose its place.
        builder.HasOne<Subject>().WithMany().HasForeignKey(e => e.SubjectId).IsRequired().OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Grade>().WithMany().HasForeignKey(e => e.GradeId).IsRequired().OnDelete(DeleteBehavior.Restrict);

        builder.Ignore(e => e.LessonCount);

        builder.HasMany(e => e.Units).WithOne()
            .HasForeignKey(e => e.TeachingMaterialId).IsRequired().OnDelete(DeleteBehavior.Cascade);
    }
}
