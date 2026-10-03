using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizMaster.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class StudentSubjectPerformanceAssignmentKind : Migration
    {
        // QuizCount / HomeworkCount now follow the assignment's Kind, as My Participations and the KPI tiles do: a quiz a
        // teacher assigns is submitted as Participation.Type = Homework, but the student sees (and counts) it as a quiz.
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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
                            -- the kind the student sees (My Participations): an assignment says what it is (a quiz can be
                            -- assigned); a submission with no assignment, or whose assignment is gone, is a quiz
                            CASE WHEN participation.HomeworkId IS NOT NULL AND (assignment.Kind IS NULL OR assignment.Kind <> N'Quiz')
                                THEN N'Homework' ELSE N'Quiz' END AS Kind,
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
                            SUM(CASE WHEN Kind = N'Quiz' THEN 1 ELSE 0 END) AS QuizCount,
                            SUM(CASE WHEN Kind = N'Homework' THEN 1 ELSE 0 END) AS HomeworkCount,
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
            migrationBuilder.Sql(StudentSubjectPerformance.Procedure);
        }
    }
}
