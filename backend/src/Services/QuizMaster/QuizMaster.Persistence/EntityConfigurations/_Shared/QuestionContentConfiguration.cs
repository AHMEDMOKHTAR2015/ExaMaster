namespace QuizMaster.Persistence.EntityConfigurations.Shared;

// The same content columns for bank questions and teacher-quiz questions.
public static class QuestionContentConfiguration
{
    public static void ConfigureQuestionContent<T>(this EntityTypeBuilder<T> builder)
        where T : class, IQuestionDefinition
    {
        builder.Property(e => e.Type).HasEnumConversion().IsRequired();
        builder.Property(e => e.Name).IsRequired();                            // text: a flattened Explain prompt can be long
        builder.Property(e => e.Options).HasJsonConversion().IsRequired();
        builder.Property(e => e.Segments).HasJsonConversion().IsRequired();
        builder.Property(e => e.SubjectHtml);

        builder.Property<IReadOnlyList<string>?>(nameof(Question.CorrectBlanks)).HasJsonConversion();
        builder.Property<string?>(nameof(Question.ReferenceAnswer));

        builder.PrimitiveCollection(e => e.TagIds);                            // SubjectTag ids; no foreign key (JSON)

        builder.Ignore(e => e.Key);
        builder.Ignore(e => e.QuestionId);
    }
}
