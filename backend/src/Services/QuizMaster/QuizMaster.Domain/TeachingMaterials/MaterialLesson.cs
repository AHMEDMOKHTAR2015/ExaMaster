namespace QuizMaster.Domain.TeachingMaterials;

// One lesson of a unit. Its body is an ordered list of typed blocks (terms, tables, examples, code...) plus the Arabic
// explanation box, both kept as the validated JSON the document carried: the app renders them, nothing queries them.
public class MaterialLesson : Entity
{
    private MaterialLesson() {}

    public int MaterialUnitId { get; private set; }
    public int Order { get; private set; }                       // 1..n inside its unit
    public string Code { get; private set; } = null!;           // as printed: "1-1", "13-4 – 13-6"
    public string Title { get; private set; } = null!;
    public string ContentJson { get; private set; } = "[]";
    public string ArabicExplanationJson { get; private set; } = "{}";

    internal static MaterialLesson Create(MaterialLessonDraft draft) => new()
    {
        Order = draft.Order,
        Code = draft.Code.Trim(),
        Title = draft.Title.Trim(),
        ContentJson = draft.ContentJson,
        ArabicExplanationJson = draft.ArabicExplanationJson
    };
}
