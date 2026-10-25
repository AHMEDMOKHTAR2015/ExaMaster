namespace QuizMaster.Domain.TeachingMaterials;

public partial class TeachingMaterial
{
    public const int MaxSourceKeyLength = MaxLength.C128;
    public const int MaxTitleLength = MaxLength.C256;
    public const int MaxSubtitleLength = MaxLength.C512;
    public const int MaxForLabelLength = MaxLength.C256;
    public const int MaxUnitKindLength = MaxLength.C32;
    public const int MaxUnitTitleLength = MaxLength.C256;
    public const int MaxLessonCodeLength = MaxLength.C64;
    public const int MaxLessonTitleLength = MaxLength.C256;
    public const int MaxUnits = 60;
    public const int MaxLessonsPerUnit = 60;

    // Only a teacher uploads material, and only for a subject on their roster record.
    public static TeachingMaterial Create(MaterialDraft draft, Subject subject, Grade grade, Teacher uploader, IQuizMasterAction action)
    {
        if (!uploader.SubjectIds.Contains(subject.Id))
            throw new DomainException($"You can only upload material for a subject you teach; {subject.Name} is not one of your subjects.");

        var material = new TeachingMaterial
        {
            CreatedById = action.CreatedById,
            CreatedOn = action.CreatedOn,
            SubjectId = subject.Id,
            GradeId = grade.Id,
            TeacherId = uploader.Id
        };
        material.Apply(draft);
        return material;
    }

    public bool IsOwnedBy(int userId) => CreatedById == userId;

    //insight - who learns from it: a class of the material's grade that studies its subject and is taught by the uploader.
    // The uploader's other classes (another grade, another subject) never see it.
    public bool IsVisibleTo(ClassGroup classGroup)
        => classGroup.GradeId == GradeId
           && classGroup.SubjectIds.Contains(SubjectId)
           && classGroup.TeacherIds.Contains(TeacherId);

    public int LessonCount => _units.Sum(unit => unit.Lessons.Count);

    private void Apply(MaterialDraft draft)
    {
        SourceKey = Required(draft.SourceKey, MaxSourceKeyLength, "The material's id");
        Title = Required(draft.Title, MaxTitleLength, "The material's title");
        Subtitle = Optional(draft.Subtitle, MaxSubtitleLength, "The material's subtitle");
        ForLabel = Optional(draft.ForLabel, MaxForLabelLength, "The material's audience line");
        Semester = draft.Semester;
        OverviewJson = string.IsNullOrWhiteSpace(draft.OverviewJson) ? "{}" : draft.OverviewJson;

        if (draft.Units.Count == 0)
            throw new DomainException("A material needs at least one unit.");
        if (draft.Units.Count > MaxUnits)
            throw new DomainException($"A material cannot have more than {MaxUnits} units.");

        var unitNumbers = new HashSet<int>();
        var lessonCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < draft.Units.Count; i++)
        {
            var unit = draft.Units[i];
            var where = $"Unit {i + 1}";
            if (unit.Number < 1)
                throw new DomainException($"{where}: a unit number must be 1 or more.");
            if (!unitNumbers.Add(unit.Number))
                throw new DomainException($"{where}: unit number {unit.Number} is used twice.");
            Required(unit.Kind, MaxUnitKindLength, $"{where}: the unit kind");
            Required(unit.Title, MaxUnitTitleLength, $"{where}: the unit title");
            if (unit.BookPageFrom > unit.BookPageTo)
                throw new DomainException($"{where}: its first book page comes after its last.");
            if (unit.Lessons.Count == 0)
                throw new DomainException($"{where}: a unit needs at least one lesson.");
            if (unit.Lessons.Count > MaxLessonsPerUnit)
                throw new DomainException($"{where}: a unit cannot have more than {MaxLessonsPerUnit} lessons.");

            for (var j = 0; j < unit.Lessons.Count; j++)
            {
                var lesson = unit.Lessons[j];
                var lessonWhere = $"{where}, lesson {j + 1}";
                var code = Required(lesson.Code, MaxLessonCodeLength, $"{lessonWhere}: the lesson code");
                if (!lessonCodes.Add(code))
                    throw new DomainException($"{lessonWhere}: lesson code {code} is used twice.");
                Required(lesson.Title, MaxLessonTitleLength, $"{lessonWhere}: the lesson title");
                if (lesson.Order != j + 1)
                    throw new DomainException($"{lessonWhere}: lessons must be numbered 1..n in the order they appear.");
            }
        }

        _units.Clear();
        _units.AddRange(draft.Units.OrderBy(unit => unit.Number).Select(MaterialUnit.Create));
    }

    private static string Required(string? value, int maxLength, string what)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.Length > maxLength)
            throw new DomainException($"{what} is required and must be at most {maxLength} characters.");
        return trimmed;
    }

    private static string? Optional(string? value, int maxLength, string what)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
            return null;
        if (trimmed.Length > maxLength)
            throw new DomainException($"{what} must be at most {maxLength} characters.");
        return trimmed;
    }
}
