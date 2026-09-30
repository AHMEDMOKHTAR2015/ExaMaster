using QuizMaster.Persistence.Accounts;

namespace QuizMaster.Persistence.EntityConfigurations;

public class RefreshTokenEntityConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.HasKey(e => e.Id);
        builder.HasIndex(e => e.TokenHash).IsUnique();
        builder.HasIndex(e => e.Uid);

        builder.Property(e => e.Uid).HasMaxLength(MaxLength.C128).UseCollation("Latin1_General_100_BIN2").IsRequired();
        builder.Property(e => e.TokenHash).HasMaxLength(MaxLength.C64).IsRequired();
        builder.Property(e => e.ReplacedByHash).HasMaxLength(MaxLength.C64);
    }
}
