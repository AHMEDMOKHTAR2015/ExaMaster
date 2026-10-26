namespace QuizMaster.Persistence.EntityConfigurations;

public class TeachingRoomMemberEntityConfiguration : EntityConfiguration<TeachingRoomMember>
{
    public override void Configure(EntityTypeBuilder<TeachingRoomMember> builder)
    {
        base.Configure(builder);

        // one request per student per room: two tabs asking at once cannot both create one
        builder.HasIndex(e => new { e.TeachingRoomId, e.StudentId }).IsUnique();

        builder.Property(e => e.Status).HasEnumConversion().IsRequired();
        builder.Ignore(e => e.IsApproved);

        builder.HasOne<User>().WithMany().HasForeignKey(e => e.StudentId).IsRequired().OnDelete(DeleteBehavior.Restrict);
    }
}
