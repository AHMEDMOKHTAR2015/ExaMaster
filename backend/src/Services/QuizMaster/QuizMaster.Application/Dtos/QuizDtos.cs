namespace QuizMaster.Application.Dtos;

// A bank quiz as its author (an administrator) edits it.
public record BankQuizDto(
    int Id,
    string Name,
    string Description,
    QuizSettings Settings,
    int? SubjectId,
    int? StageId,
    int? GradeId,
    int? ClassId,
    Semester? Semester,
    int? ReviewerId,
    IReadOnlyList<int> QuestionIds,
    DateTime CreatedOn);

// A bank quiz in a list. CompletedByMe lets a student's list hide what they already sat, as the app does.
public record BankQuizSummaryDto(
    int Id,
    string Name,
    string Description,
    QuizSettings Settings,
    int? SubjectId,
    int? StageId,
    int? GradeId,
    int? ClassId,
    Semester? Semester,
    int? ReviewerId,
    int QuestionCount,
    bool CompletedByMe);

public record TeacherQuizDto(
    int Id,
    string Name,
    string Description,
    QuizSettings Settings,
    int SubjectId,
    int? StageId,
    Semester? Semester,
    int CreatedById,
    DateTime CreatedOn,
    IReadOnlyList<TeacherQuizQuestionDto> Questions);

public record TeacherQuizQuestionDto(
    int Number,
    QuestionType Type,
    string Name,
    string? Text,
    IReadOnlyList<QuestionOption> Options,
    IReadOnlyList<CompleteSegment> Segments,
    string? SubjectHtml,
    double? WeightPercent,
    int? DurationSeconds,
    AnswerKeyDto Key);

public record TeacherQuizSummaryDto(
    int Id,
    string Name,
    string Description,
    int SubjectId,
    int? StageId,
    Semester? Semester,
    int CreatedById,
    int QuestionCount,
    DateTime CreatedOn);
