namespace QuizMaster.Persistence.EntityConfigurations;

public class TeachingRoomEntityConfiguration : TenantAggregateConfiguration<TeachingRoom>
{
    // rowversion: every change touches the room row (TeachingRoom.Touch), so a double Next or an approve racing a reject
    // is refused (409) instead of one silently overwriting the other.
    protected override bool HasConcurrencyToken => true;

    public override void Configure(EntityTypeBuilder<TeachingRoom> builder)
    {
        base.Configure(builder);

        builder.HasIndex(e => new { e.TenantId, e.CreatedById });
        builder.HasIndex(e => new { e.TenantId, e.TeachingMaterialId });

        builder.Ignore(e => e.CanGoPrevious);
        builder.Ignore(e => e.CanGoNext);

        // Deleting the material ends the rooms presenting it; its subject cannot be deleted while either exists.
        builder.HasOne<TeachingMaterial>().WithMany().HasForeignKey(e => e.TeachingMaterialId).IsRequired().OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Subject>().WithMany().HasForeignKey(e => e.SubjectId).IsRequired().OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(e => e.Members).WithOne()
            .HasForeignKey(e => e.TeachingRoomId).IsRequired().OnDelete(DeleteBehavior.Cascade);
    }
}
