using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizMaster.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class StudentSubjectPerformance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A student's standing per subject over the last @Months: the average score of their quizzes and homework.
            // It runs outside EF, so the tenant query filter does not apply: every read below is pinned to the student's
            // own tenant explicitly. Called by GetMySubjectPerformanceQueryHandler with the caller's own sign-in uid.
            //  - subject: the assignment's subject, else the quiz's (the client's effectiveSubjectId);
            //  - a submission still waiting for a teacher's mark is counted but not scored (its score rises as it is marked);
            //  - a rejected submission is ignored: its retake replaces it;
            //  - rounding is JavaScript's Math.round (FLOOR(x + 0.5)), as QuizScoring.RoundPercent;
            //  - EarlierPercent / RecentPercent: the first and second half of the period, for the trend.
            migrationBuilder.Sql("""
                CREATE OR ALTER PROCEDURE dbo.GetStudentSubjectPerformance
                    @SignInUid nvarchar(128),
                    @Months int = 12
                AS
                BEGIN
                    SET NOCOUNT ON;

                    SET @Months = CASE WHEN @Months < 1 THEN 1 WHEN @Months > 60 THEN 60 ELSE @Months END;

                    DECLARE @StudentId int, @TenantId int;
                    SELECT @StudentId = Id, @TenantId = TenantId
                    FROM dbo.[User]
                    WHERE SignInUid = @SignInUid AND TenantId <> 0;

                    DECLARE @Now datetime2 = SYSUTCDATETIME();
                    DECLARE @Since datetime2 = DATEADD(MONTH, -@Months, @Now);
                    DECLARE @Midpoint datetime2 = DATEADD(SECOND, DATEDIFF(SECOND, @Since, @Now) / 2, @Since);

                    WITH Submission AS (
                        SELECT
                            COALESCE(assignment.SubjectId, teacherQuiz.SubjectId, bankQuiz.SubjectId) AS SubjectId,
                            participation.Type,
                            participation.EndedOn,
                            CASE WHEN participation.PendingReviewCount = 0 THEN CAST(participation.ScorePercent AS float) END AS GradedScore
                        FROM dbo.Participation AS participation
                        LEFT JOIN dbo.HomeworkAssignment AS assignment
                            ON assignment.Id = participation.HomeworkId AND assignment.TenantId = @TenantId
                        LEFT JOIN dbo.TeacherQuiz AS teacherQuiz
                            ON teacherQuiz.Id = participation.TeacherQuizId AND teacherQuiz.TenantId = @TenantId
                        LEFT JOIN dbo.BankQuiz AS bankQuiz
                            ON bankQuiz.Id = participation.BankQuizId AND bankQuiz.TenantId = @TenantId
                        WHERE participation.TenantId = @TenantId
                          AND participation.ChildId = @StudentId
                          AND participation.EndedOn >= @Since
                          AND (participation.ValidationStatus IS NULL OR participation.ValidationStatus <> N'Rejected')
                    ),
                    BySubject AS (
                        SELECT
                            SubjectId,
                            SUM(CASE WHEN Type = N'Quiz' THEN 1 ELSE 0 END) AS QuizCount,
                            SUM(CASE WHEN Type = N'Homework' THEN 1 ELSE 0 END) AS HomeworkCount,
                            SUM(CASE WHEN GradedScore IS NULL THEN 1 ELSE 0 END) AS AwaitingReviewCount,
                            CAST(FLOOR(AVG(GradedScore) + 0.5) AS int) AS ScorePercent,
                            CAST(FLOOR(AVG(CASE WHEN EndedOn < @Midpoint THEN GradedScore END) + 0.5) AS int) AS EarlierPercent,
                            CAST(FLOOR(AVG(CASE WHEN EndedOn >= @Midpoint THEN GradedScore END) + 0.5) AS int) AS RecentPercent
                        FROM Submission
                        WHERE SubjectId IS NOT NULL
                        GROUP BY SubjectId
                    )
                    SELECT
                        subject.Id AS SubjectId,
                        subject.Name AS SubjectName,
                        subject.Color AS SubjectColor,
                        bySubject.QuizCount,
                        bySubject.HomeworkCount,
                        bySubject.AwaitingReviewCount,
                        bySubject.ScorePercent,
                        bySubject.EarlierPercent,
                        bySubject.RecentPercent,
                        CAST(CASE
                            WHEN bySubject.ScorePercent IS NULL THEN NULL
                            WHEN bySubject.ScorePercent >= 85 THEN N'Excellent'
                            WHEN bySubject.ScorePercent >= 70 THEN N'Good'
                            WHEN bySubject.ScorePercent >= 50 THEN N'Fair'
                            ELSE N'Weak'
                        END AS nvarchar(16)) AS Level
                    FROM BySubject AS bySubject
                    JOIN dbo.Subject AS subject ON subject.Id = bySubject.SubjectId AND subject.TenantId = @TenantId
                    ORDER BY CASE WHEN bySubject.ScorePercent IS NULL THEN 1 ELSE 0 END, bySubject.ScorePercent DESC, subject.Name;
                END
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.GetStudentSubjectPerformance;");
        }
    }
}
