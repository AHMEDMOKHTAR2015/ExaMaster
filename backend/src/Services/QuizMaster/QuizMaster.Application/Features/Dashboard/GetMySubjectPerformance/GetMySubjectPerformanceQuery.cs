namespace QuizMaster.Application.Features.Dashboard.GetMySubjectPerformance;

// A student's standing in each subject they have sat quizzes or homework in over the last year: the dashboard's donuts,
// read at a glance for strengths (green) and weaknesses (red). Computed by the database (dbo.GetStudentSubjectPerformance).
public record GetMySubjectPerformanceQuery : IQuery<IReadOnlyList<SubjectPerformanceDto>>;

// ScorePercent and Level are null while every submission in the subject still waits for a teacher's mark.
// EarlierPercent / RecentPercent: the first and second half of the year (null when that half has no graded work).
public record SubjectPerformanceDto(
    int SubjectId,
    string SubjectName,
    string? SubjectColor,
    int QuizCount,
    int HomeworkCount,
    int AwaitingReviewCount,
    int? ScorePercent,
    int? EarlierPercent,
    int? RecentPercent,
    string? Level);
