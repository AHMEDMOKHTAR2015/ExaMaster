namespace QuizMaster.Persistence.EntityConfigurations.Shared;

public static class QuizSettingsConfiguration
{
    // A value object mapped as a complex property: its columns live on the quiz's own row (settings_allow_back, ...).
    public static void ConfigureSettings<T>(this EntityTypeBuilder<T> builder)
        where T : class
        => builder.ComplexProperty<QuizSettings>(nameof(BankQuiz.Settings), settings =>
        {
            settings.IsRequired();
            settings.Property(s => s.ImagePath).HasMaxLength(MaxLength.C256);
        });
}
