using System.Text.Json;

namespace QuizMaster.Application.Dtos;

public record TeachingMaterialSummaryDto(
    int Id,
    string SourceKey,
    string Title,
    string? Subtitle,
    int SubjectId,
    int GradeId,
    Semester? Semester,
    int UnitCount,
    int LessonCount,
    int CreatedById,
    string? UploadedByName,
    DateTime CreatedOn);

// The whole material, for its reader. Overview, lesson content and Arabic explanations are the document's own JSON.
public record TeachingMaterialDto(
    int Id,
    string SourceKey,
    string Title,
    string? Subtitle,
    string? ForLabel,
    int SubjectId,
    int GradeId,
    Semester? Semester,
    int CreatedById,
    DateTime CreatedOn,
    JsonElement Overview,
    IReadOnlyList<MaterialUnitDto> Units);

public record MaterialUnitDto(
    int Id,
    int Number,
    string Kind,
    string Title,
    int? BookPageFrom,
    int? BookPageTo,
    string BigIdeaEnglish,
    string BigIdeaArabic,
    IReadOnlyList<string> KeyTakeaways,
    IReadOnlyList<MaterialLessonDto> Lessons);

public record MaterialLessonDto(int Id, int Order, string Code, string Title, JsonElement Content, JsonElement ArabicExplanation);
