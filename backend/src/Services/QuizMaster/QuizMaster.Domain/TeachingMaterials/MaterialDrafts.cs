namespace QuizMaster.Domain.TeachingMaterials;

// A material as read from its document, before the aggregate's rules have accepted it.
public sealed record MaterialDraft(
    string SourceKey,
    string Title,
    string? Subtitle,
    string? ForLabel,
    Semester? Semester,
    string OverviewJson,
    IReadOnlyList<MaterialUnitDraft> Units);

public sealed record MaterialUnitDraft(
    int Number,
    string Kind,
    string Title,
    int? BookPageFrom,
    int? BookPageTo,
    string BigIdeaEnglish,
    string BigIdeaArabic,
    IReadOnlyList<string> KeyTakeaways,
    IReadOnlyList<MaterialLessonDraft> Lessons);

public sealed record MaterialLessonDraft(int Order, string Code, string Title, string ContentJson, string ArabicExplanationJson);
