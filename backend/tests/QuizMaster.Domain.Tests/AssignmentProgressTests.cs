namespace QuizMaster.Domain.Tests;

public class AssignmentProgressTests
{
    private static readonly DateTime Now = new(2026, 10, 3, 12, 0, 0, DateTimeKind.Utc);

    private static Dictionary<int, LatestSubmission> Submitted(params (int StudentId, int Score, bool Validated)[] submissions)
        => submissions.ToDictionary(s => s.StudentId, s => new LatestSubmission(s.Score, s.Validated));

    [Fact]
    public void Counts_each_targeted_student_once_by_whether_they_submitted()
    {
        var progress = AssignmentProgress.Of([1, 2, 3, 4], Submitted((1, 80, true), (2, 61, false)), Now.AddDays(1), Now);

        Assert.Equal(new AssignmentProgress(Targeted: 4, Completed: 2, NotStarted: 2, Overdue: 0, Validated: 1, AverageScore: 71), progress);
        Assert.Equal(50, progress.CompletionRate);
    }

    [Fact]
    public void A_student_with_nothing_submitted_is_overdue_once_the_assignment_is_due()
    {
        var progress = AssignmentProgress.Of([1, 2], Submitted((1, 90, false)), Now.AddMinutes(-1), Now);

        Assert.Equal(1, progress.Overdue);
        Assert.Equal(0, progress.NotStarted);
    }

    [Fact]
    public void Submissions_from_students_it_was_not_set_for_do_not_count()
    {
        var progress = AssignmentProgress.Of([1], Submitted((1, 40, false), (99, 100, true)), Now.AddDays(1), Now);

        Assert.Equal(1, progress.Completed);
        Assert.Equal(40, progress.AverageScore);
        Assert.Equal(0, progress.Validated);
    }

    [Fact]
    public void Rounds_half_up_like_the_rest_of_the_scores()
    {
        // (70 + 71) / 2 = 70.5: banker's rounding would give 70, the app's Math.round gives 71
        var progress = AssignmentProgress.Of([1, 2], Submitted((1, 70, false), (2, 71, false)), Now, Now);

        Assert.Equal(71, progress.AverageScore);
    }

    [Fact]
    public void An_assignment_set_for_nobody_is_all_zero()
    {
        var progress = AssignmentProgress.Of([], Submitted(), Now, Now);

        Assert.Equal(new AssignmentProgress(0, 0, 0, 0, 0, 0), progress);
        Assert.Equal(0, progress.CompletionRate);
    }
}
