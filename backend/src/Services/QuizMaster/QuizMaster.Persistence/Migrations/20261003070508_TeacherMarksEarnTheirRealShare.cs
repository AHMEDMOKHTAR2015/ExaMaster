using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizMaster.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TeacherMarksEarnTheirRealShare : Migration
    {
        // Re-scores submissions a teacher has already marked, under the rule now in the domain: a mark is POINTS out of
        // QuizScoring.MaxMark (the answer's share rounded, at least 1) and earns that proportion of the real share
        // (QuizScoring.EarnedFromMark); a score is capped at 100 (QuizScoring.ScorePercent). Before, the points were counted
        // as percent, so full marks scored 94% on a 29-question quiz and 112% on a 40-question one.
        // The teacher's points (AwardedPercent) and verdicts are kept exactly as given; only what they earn is recomputed.
        // Submissions with no marked answer are untouched: their score never involved a mark.

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE answer
                SET EarnedPercent = answer.WeightPercent * answer.AwardedPercent / maxMark.Points
                FROM dbo.ParticipationAnswer AS answer
                CROSS APPLY (SELECT CASE WHEN FLOOR(answer.WeightPercent + 0.5) < 1 THEN 1.0
                                         ELSE FLOOR(answer.WeightPercent + 0.5) END AS Points) AS maxMark
                WHERE answer.RequiresReview = 1 AND answer.GradedOn IS NOT NULL AND answer.AwardedPercent IS NOT NULL;
                """);

            migrationBuilder.Sql(RecomputeMarkedScores(capAt100: true));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE dbo.ParticipationAnswer
                SET EarnedPercent = AwardedPercent
                WHERE RequiresReview = 1 AND GradedOn IS NOT NULL AND AwardedPercent IS NOT NULL;
                """);

            migrationBuilder.Sql(RecomputeMarkedScores(capAt100: false));
        }

        // A submission's score is its earned shares added up and rounded half up (JavaScript's Math.round).
        private static string RecomputeMarkedScores(bool capAt100)
        {
            var rounded = "FLOOR(SUM(ISNULL(answer.EarnedPercent, 0)) + 0.5)";
            var score = capAt100 ? $"CASE WHEN {rounded} > 100 THEN 100 ELSE {rounded} END" : rounded;

            return $"""
                UPDATE participation
                SET ScorePercent = scored.ScorePercent
                FROM dbo.Participation AS participation
                JOIN (
                    SELECT answer.ParticipationId, CAST({score} AS int) AS ScorePercent
                    FROM dbo.ParticipationAnswer AS answer
                    GROUP BY answer.ParticipationId
                    HAVING MAX(CASE WHEN answer.RequiresReview = 1 AND answer.GradedOn IS NOT NULL THEN 1 ELSE 0 END) = 1
                ) AS scored ON scored.ParticipationId = participation.Id;
                """;
        }
    }
}
