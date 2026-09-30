namespace QuizMaster.Domain.Questions;

// Where a bank question belongs, for filtering. Every member is optional: an unclassified question is visible everywhere.
public sealed record QuestionClassification(int? SubjectId = null, int? StageId = null, int? GradeId = null, Semester? Semester = null)
{
    public static readonly QuestionClassification None = new();
}
