namespace QuizMaster.Persistence.EntityConfigurations;

public class ParticipationAnswerEntityConfiguration : EntityConfiguration<ParticipationAnswer>
{
    public override void Configure(EntityTypeBuilder<ParticipationAnswer> builder)
    {
        base.Configure(builder);

        builder.HasIndex(e => new { e.ParticipationId, e.Position }).IsUnique();

        builder.Property(e => e.QuestionName).IsRequired();
        builder.Property(e => e.SelectedOptionText).HasMaxLength(MaxLength.C512);
        builder.Property(e => e.CorrectOptionText).HasMaxLength(MaxLength.C512);
        builder.Property(e => e.Blanks).HasJsonConversion();
        builder.Property(e => e.GradeComment).HasMaxLength(MaxLength.C2048);
    }
}
