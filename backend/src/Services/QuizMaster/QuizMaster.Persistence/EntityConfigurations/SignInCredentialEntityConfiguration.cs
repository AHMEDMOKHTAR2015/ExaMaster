using QuizMaster.Persistence.Accounts;

namespace QuizMaster.Persistence.EntityConfigurations;

public class SignInCredentialEntityConfiguration : IEntityTypeConfiguration<SignInCredential>
{
    public void Configure(EntityTypeBuilder<SignInCredential> builder)
    {
        builder.HasKey(e => e.Id);
        builder.HasIndex(e => e.Uid).IsUnique();
        builder.HasIndex(e => e.Email).IsUnique();

        builder.Property(e => e.Uid).HasMaxLength(MaxLength.C128).UseCollation("Latin1_General_100_BIN2").IsRequired();
        builder.Property(e => e.Email).HasMaxLength(MaxLength.C256).IsRequired();
        builder.Property(e => e.PasswordHash).HasMaxLength(MaxLength.C512);
    }
}
