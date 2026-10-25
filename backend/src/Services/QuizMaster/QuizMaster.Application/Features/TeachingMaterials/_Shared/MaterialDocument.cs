using System.Text;
using System.Text.Json;

namespace QuizMaster.Application.Features.TeachingMaterials.Shared;

public sealed record MaterialDocumentError(string Path, string Message);
public sealed record MaterialDocumentReadResult(MaterialDraft? Draft, IReadOnlyList<MaterialDocumentError> Errors);

// Reads an uploaded teaching-summary document (teaching-summary.schema.json, schemaVersion 1) into a MaterialDraft.
// Only the shape is checked here: every block type and its fields, so the reader can render whatever it is given.
// The material's own rules (lengths, unique numbers and codes, the uploader's subjects) are the aggregate's.
public static class MaterialDocument
{
    public const int SchemaVersion = 1;
    private const int MaxErrors = 20;

    private static readonly HashSet<string> TextBlocks = ["heading", "paragraph", "note", "formula"];
    private static readonly HashSet<string> ArabicItemTypes = ["paragraph", "bullet", "example"];

    public static MaterialDocumentReadResult Read(JsonElement document)
    {
        var errors = new List<MaterialDocumentError>();
        void Fail(string path, string message)
        {
            if (errors.Count < MaxErrors)
                errors.Add(new MaterialDocumentError(path, message));
        }

        if (document.ValueKind != JsonValueKind.Object)
            return new MaterialDocumentReadResult(null, [new MaterialDocumentError("document", "The file must contain one JSON object (a teaching summary).")]);

        if (document.TryGetProperty("schemaVersion", out var version)
            && !(version.ValueKind == JsonValueKind.Number && version.TryGetInt32(out var number) && number == SchemaVersion))
            Fail("schemaVersion", $"Only schemaVersion {SchemaVersion} is supported.");

        var sourceKey = RequiredString(document, "id", "id", Fail);
        var title = RequiredString(document, "title", "title", Fail);
        var subtitle = OptionalString(document, "subtitle", "subtitle", Fail);
        var forLabel = OptionalString(document, "forLabel", "forLabel", Fail);
        var semester = ReadSemester(document, Fail);

        var units = new List<MaterialUnitDraft>();
        if (!document.TryGetProperty("units", out var unitsElement) || unitsElement.ValueKind != JsonValueKind.Array || unitsElement.GetArrayLength() == 0)
            Fail("units", "The document needs a non-empty \"units\" list.");
        else
        {
            var i = 0;
            foreach (var unitElement in unitsElement.EnumerateArray())
            {
                i++;
                if (ReadUnit(unitElement, $"Unit {i}", Fail) is { } unit)
                    units.Add(unit);
            }
        }

        return errors.Count > 0
            ? new MaterialDocumentReadResult(null, errors)
            : new MaterialDocumentReadResult(new MaterialDraft(sourceKey!, title!, subtitle, forLabel, semester, OverviewOf(document), units), []);
    }

    // Everything but the units: the front matter the reader shows above the first unit.
    private static string OverviewOf(JsonElement document)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            foreach (var property in document.EnumerateObject().Where(property => property.Name != "units"))
                property.WriteTo(writer);
            writer.WriteEndObject();
        }
        return Encoding.UTF8.GetString(stream.ToArray());
    }

    private static Semester? ReadSemester(JsonElement document, Action<string, string> fail)
    {
        if (!document.TryGetProperty("audience", out var audience) || audience.ValueKind == JsonValueKind.Null)
            return null;
        if (audience.ValueKind != JsonValueKind.Object)
        {
            fail("audience", "\"audience\" must be an object.");
            return null;
        }
        if (!audience.TryGetProperty("semester", out var semester) || semester.ValueKind == JsonValueKind.Null)
            return null;
        if (semester.ValueKind == JsonValueKind.String && Enum.TryParse<Semester>(semester.GetString(), ignoreCase: true, out var parsed)
            && Enum.IsDefined(parsed))
            return parsed;

        fail("audience.semester", "The semester must be \"First\", \"Second\", \"Full\" or null.");
        return null;
    }

    private static MaterialUnitDraft? ReadUnit(JsonElement unit, string where, Action<string, string> fail)
    {
        if (unit.ValueKind != JsonValueKind.Object)
        {
            fail(where, "A unit must be an object.");
            return null;
        }

        var number = RequiredInt(unit, "number", $"{where}: number", fail);
        var kind = RequiredString(unit, "kind", $"{where}: kind", fail);
        var title = RequiredString(unit, "title", $"{where}: title", fail);

        int? pageFrom = null, pageTo = null;
        if (unit.TryGetProperty("bookPages", out var pages) && pages.ValueKind != JsonValueKind.Null)
        {
            pageFrom = RequiredInt(pages, "from", $"{where}: bookPages.from", fail);
            pageTo = RequiredInt(pages, "to", $"{where}: bookPages.to", fail);
        }

        string? bigIdeaEnglish = null, bigIdeaArabic = null;
        if (!unit.TryGetProperty("bigIdea", out var bigIdea) || bigIdea.ValueKind != JsonValueKind.Object)
            fail($"{where}: bigIdea", "A unit needs a \"bigIdea\" object with \"en\" and \"ar\".");
        else
        {
            bigIdeaEnglish = RequiredString(bigIdea, "en", $"{where}: bigIdea.en", fail);
            bigIdeaArabic = RequiredString(bigIdea, "ar", $"{where}: bigIdea.ar", fail);
        }

        var takeaways = StringList(unit, "keyTakeaways", $"{where}: keyTakeaways", fail, required: false);

        var lessons = new List<MaterialLessonDraft>();
        if (!unit.TryGetProperty("lessons", out var lessonsElement) || lessonsElement.ValueKind != JsonValueKind.Array)
            fail($"{where}: lessons", "A unit needs a \"lessons\" list.");
        else
        {
            var j = 0;
            foreach (var lessonElement in lessonsElement.EnumerateArray())
            {
                j++;
                if (ReadLesson(lessonElement, $"{where}, lesson {j}", fail) is { } lesson)
                    lessons.Add(lesson);
            }
        }

        return number is null || kind is null || title is null || bigIdeaEnglish is null || bigIdeaArabic is null
            ? null
            : new MaterialUnitDraft(number.Value, kind, title, pageFrom, pageTo, bigIdeaEnglish, bigIdeaArabic, takeaways, lessons);
    }

    private static MaterialLessonDraft? ReadLesson(JsonElement lesson, string where, Action<string, string> fail)
    {
        if (lesson.ValueKind != JsonValueKind.Object)
        {
            fail(where, "A lesson must be an object.");
            return null;
        }

        var order = RequiredInt(lesson, "order", $"{where}: order", fail);
        var code = RequiredString(lesson, "code", $"{where}: code", fail);
        var title = RequiredString(lesson, "title", $"{where}: title", fail);

        var contentOk = false;
        if (!lesson.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array || content.GetArrayLength() == 0)
            fail($"{where}: content", "A lesson needs a non-empty \"content\" list of blocks.");
        else
        {
            contentOk = true;
            var k = 0;
            foreach (var block in content.EnumerateArray())
                contentOk &= CheckBlock(block, $"{where}, block {++k}", fail);
        }

        var arabicOk = false;
        if (!lesson.TryGetProperty("arabicExplanation", out var arabic))
            fail($"{where}: arabicExplanation", "A lesson needs an \"arabicExplanation\" object.");
        else
            arabicOk = CheckArabicExplanation(arabic, $"{where}: arabicExplanation", fail);

        return order is null || code is null || title is null || !contentOk || !arabicOk
            ? null
            : new MaterialLessonDraft(order.Value, code, title, content.GetRawText(), arabic.GetRawText());
    }

    private static bool CheckBlock(JsonElement block, string where, Action<string, string> fail)
    {
        if (block.ValueKind != JsonValueKind.Object || !block.TryGetProperty("type", out var typeElement) || typeElement.ValueKind != JsonValueKind.String)
        {
            fail(where, "A block must be an object with a \"type\".");
            return false;
        }

        var type = typeElement.GetString()!;
        var before = new ErrorCounter(fail);
        switch (type)
        {
            case var text when TextBlocks.Contains(text):
                RequiredString(block, "text", $"{where} ({type}): text", before.Fail);
                break;
            case "example":
                RequiredString(block, "label", $"{where} (example): label", before.Fail);
                RequiredString(block, "text", $"{where} (example): text", before.Fail);
                break;
            case "list":
                if (!block.TryGetProperty("ordered", out var ordered) || ordered.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
                    before.Fail($"{where} (list): ordered", "\"ordered\" must be true or false.");
                StringList(block, "items", $"{where} (list): items", before.Fail, required: true);
                break;
            case "terms":
                CheckTerms(block, where, before.Fail);
                break;
            case "table":
                CheckTable(block, where, before.Fail);
                break;
            case "code":
                RequiredString(block, "language", $"{where} (code): language", before.Fail);
                RequiredString(block, "code", $"{where} (code): code", before.Fail);
                break;
            default:
                before.Fail(where, $"Unknown block type \"{type}\".");
                break;
        }
        return before.Count == 0;
    }

    private static void CheckTerms(JsonElement block, string where, Action<string, string> fail)
    {
        if (!block.TryGetProperty("items", out var items) || items.ValueKind != JsonValueKind.Array || items.GetArrayLength() == 0)
        {
            fail($"{where} (terms): items", "A terms block needs a non-empty \"items\" list.");
            return;
        }
        var i = 0;
        foreach (var item in items.EnumerateArray())
        {
            i++;
            if (item.ValueKind != JsonValueKind.Object)
            {
                fail($"{where} (terms): item {i}", "A term must be an object with term, termAr and definition.");
                continue;
            }
            RequiredString(item, "term", $"{where} (terms): item {i}.term", fail);
            RequiredString(item, "termAr", $"{where} (terms): item {i}.termAr", fail);
            RequiredString(item, "definition", $"{where} (terms): item {i}.definition", fail);
        }
    }

    private static void CheckTable(JsonElement block, string where, Action<string, string> fail)
    {
        if (!block.TryGetProperty("columns", out var columns) || columns.ValueKind != JsonValueKind.Array || columns.GetArrayLength() == 0
            || columns.EnumerateArray().Any(column => column.ValueKind != JsonValueKind.String))
        {
            fail($"{where} (table): columns", "A table needs a non-empty \"columns\" list of strings.");
            return;
        }
        if (!block.TryGetProperty("rows", out var rows) || rows.ValueKind != JsonValueKind.Array || rows.GetArrayLength() == 0)
        {
            fail($"{where} (table): rows", "A table needs a non-empty \"rows\" list.");
            return;
        }
        var width = columns.GetArrayLength();
        var r = 0;
        foreach (var row in rows.EnumerateArray())
        {
            r++;
            if (row.ValueKind != JsonValueKind.Array || row.EnumerateArray().Any(cell => cell.ValueKind != JsonValueKind.String))
                fail($"{where} (table): row {r}", "A row must be a list of strings.");
            else if (row.GetArrayLength() != width)
                fail($"{where} (table): row {r}", $"The row has {row.GetArrayLength()} cells but the table has {width} columns.");
        }
    }

    private static bool CheckArabicExplanation(JsonElement arabic, string where, Action<string, string> fail)
    {
        var counter = new ErrorCounter(fail);
        if (arabic.ValueKind != JsonValueKind.Object)
        {
            counter.Fail(where, "\"arabicExplanation\" must be an object with a title and items.");
            return false;
        }
        RequiredString(arabic, "title", $"{where}.title", counter.Fail);
        if (!arabic.TryGetProperty("items", out var items) || items.ValueKind != JsonValueKind.Array)
            counter.Fail($"{where}.items", "\"items\" must be a list.");
        else
        {
            var i = 0;
            foreach (var item in items.EnumerateArray())
            {
                i++;
                if (item.ValueKind != JsonValueKind.Object || !item.TryGetProperty("type", out var type)
                    || type.ValueKind != JsonValueKind.String || !ArabicItemTypes.Contains(type.GetString()!))
                    counter.Fail($"{where}.items[{i}]", "An item needs a type of paragraph, bullet or example.");
                else
                    RequiredString(item, "text", $"{where}.items[{i}].text", counter.Fail);
            }
        }
        return counter.Count == 0;
    }

    // ---- primitives ----

    private static string? RequiredString(JsonElement owner, string name, string path, Action<string, string> fail)
    {
        if (owner.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString()))
            return value.GetString();
        fail(path, $"\"{name}\" is required and must be text.");
        return null;
    }

    private static string? OptionalString(JsonElement owner, string name, string path, Action<string, string> fail)
    {
        if (!owner.TryGetProperty(name, out var value) || value.ValueKind == JsonValueKind.Null)
            return null;
        if (value.ValueKind == JsonValueKind.String)
            return value.GetString();
        fail(path, $"\"{name}\" must be text.");
        return null;
    }

    private static int? RequiredInt(JsonElement owner, string name, string path, Action<string, string> fail)
    {
        if (owner.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number))
            return number;
        fail(path, $"\"{name}\" is required and must be a whole number.");
        return null;
    }

    private static List<string> StringList(JsonElement owner, string name, string path, Action<string, string> fail, bool required)
    {
        if (!owner.TryGetProperty(name, out var value) || value.ValueKind == JsonValueKind.Null)
        {
            if (required)
                fail(path, $"\"{name}\" is required.");
            return [];
        }
        if (value.ValueKind != JsonValueKind.Array || value.EnumerateArray().Any(item => item.ValueKind != JsonValueKind.String)
            || (required && value.GetArrayLength() == 0))
        {
            fail(path, $"\"{name}\" must be a {(required ? "non-empty " : "")}list of text.");
            return [];
        }
        return value.EnumerateArray().Select(item => item.GetString()!).ToList();
    }

    // Counts the failures one part reports, so the caller knows whether that part was accepted.
    private sealed class ErrorCounter(Action<string, string> inner)
    {
        public int Count { get; private set; }

        public void Fail(string path, string message)
        {
            Count++;
            inner(path, message);
        }
    }
}
