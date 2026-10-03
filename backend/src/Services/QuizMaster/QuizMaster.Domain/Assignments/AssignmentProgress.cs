namespace QuizMaster.Domain.Assignments;

// How far an assignment's students have got: the Results figures of Quiz Management. Each targeted student counts
// once, by their latest submission. Someone with none is overdue once the assignment is due, else not started.
// AverageScore is over the students who submitted; percentages round as JavaScript's Math.round (QuizScoring).
public sealed record AssignmentProgress(int Targeted, int Completed, int NotStarted, int Overdue, int Validated, int AverageScore)
{
    public int CompletionRate => Targeted == 0 ? 0 : QuizScoring.RoundPercent(100.0 * Completed / Targeted);

    public static AssignmentProgress Of(
        IReadOnlyCollection<int> targetedStudentIds,
        IReadOnlyDictionary<int, LatestSubmission> latestByStudent,
        DateTime dueAt,
        DateTime now)
    {
        int completed = 0, notStarted = 0, overdue = 0, validated = 0;
        var scoreSum = 0.0;

        foreach (var studentId in targetedStudentIds.Distinct())
        {
            if (latestByStudent.TryGetValue(studentId, out var submission))
            {
                completed++;
                scoreSum += submission.ScorePercent;
                if (submission.IsValidated) validated++;
            }
            else if (dueAt < now)
                overdue++;
            else
                notStarted++;
        }

        var targeted = completed + notStarted + overdue;
        var average = completed == 0 ? 0 : QuizScoring.RoundPercent(scoreSum / completed);
        return new AssignmentProgress(targeted, completed, notStarted, overdue, validated, average);
    }
}

// A student's most recent submission to an assignment, as far as progress is concerned.
public sealed record LatestSubmission(int ScorePercent, bool IsValidated);
