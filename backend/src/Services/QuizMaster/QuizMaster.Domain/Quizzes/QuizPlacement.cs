namespace QuizMaster.Domain.Quizzes;

// Who a bank quiz is for. A quiz without a stage is open to every student of the organization.
public sealed record QuizPlacement(int? SubjectId = null, int? StageId = null, int? GradeId = null, int? ClassId = null, Semester? Semester = null)
{
    public static readonly QuizPlacement Open = new();
}
