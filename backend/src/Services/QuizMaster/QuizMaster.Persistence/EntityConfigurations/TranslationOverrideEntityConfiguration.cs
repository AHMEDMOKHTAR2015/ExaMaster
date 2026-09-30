namespace QuizMaster.Persistence.EntityConfigurations;

public class TranslationOverrideEntityConfiguration : TenantAggregateConfiguration<TranslationOverride>
{
    public override void Configure(EntityTypeBuilder<TranslationOverride> builder)
    {
        base.Configure(builder);

        // one row per label per language per school; also the read path (a school's labels in one language)
        builder.HasIndex(e => new { e.TenantId, e.Language, e.Key }).IsUnique();

        builder.Property(e => e.Language).HasMaxLength(MaxLength.C8).IsRequired();
        // keys are case-sensitive in the client's JSON ("nav.Dashboard" is not "nav.dashboard")
        builder.Property(e => e.Key).HasMaxLength(TranslationOverride.MaxKeyLength).UseCollation("Latin1_General_100_BIN2").IsRequired();
        builder.Property(e => e.Text).HasMaxLength(TranslationOverride.MaxTextLength).IsRequired();
    }
}
