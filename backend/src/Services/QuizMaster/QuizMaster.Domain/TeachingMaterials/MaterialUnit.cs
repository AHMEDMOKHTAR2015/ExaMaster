namespace QuizMaster.Domain.TeachingMaterials;

// One unit (or chapter) of a teaching material. Created only through TeachingMaterial.
public class MaterialUnit : Entity
{
    private MaterialUnit() {}

    public int TeachingMaterialId { get; private set; }
    public int Number { get; private set; }
    public string Kind { get; private set; } = null!;           // "Chapter" or "Unit", as the book names them
    public string Title { get; private set; } = null!;
    public int? BookPageFrom { get; private set; }
    public int? BookPageTo { get; private set; }
    public string BigIdeaEnglish { get; private set; } = string.Empty;
    public string BigIdeaArabic { get; private set; } = string.Empty;
    public IReadOnlyList<string> KeyTakeaways { get; private set; } = [];

    private readonly List<MaterialLesson> _lessons = new();
    public IReadOnlyList<MaterialLesson> Lessons => _lessons.AsReadOnly();

    internal static MaterialUnit Create(MaterialUnitDraft draft)
    {
        var unit = new MaterialUnit
        {
            Number = draft.Number,
            Kind = draft.Kind.Trim(),
            Title = draft.Title.Trim(),
            BookPageFrom = draft.BookPageFrom,
            BookPageTo = draft.BookPageTo,
            BigIdeaEnglish = draft.BigIdeaEnglish.Trim(),
            BigIdeaArabic = draft.BigIdeaArabic.Trim(),
            KeyTakeaways = draft.KeyTakeaways.Select(takeaway => takeaway.Trim()).ToList()
        };
        unit._lessons.AddRange(draft.Lessons.Select(MaterialLesson.Create));
        return unit;
    }
}
