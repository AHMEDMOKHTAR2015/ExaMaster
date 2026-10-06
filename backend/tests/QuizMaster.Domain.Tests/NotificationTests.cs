using static QuizMaster.Domain.Tests.TestData;

namespace QuizMaster.Domain.Tests;

public class NotificationTests
{
    private static readonly ClassGroup StudentsClass = Class();

    private static Participation Submit(AttemptedQuiz quiz, IReadOnlyCollection<QuestionResponse> responses, HomeworkAssignment? homework = null, User? student = null)
        => Participation.Submit(student ?? Student(StudentsClass), quiz, homework, null, responses, null,
            Action(QuizMasterActionType.SubmitQuiz, StudentId)).WithId(500);

    private static IReadOnlyList<Notification> Announce(Participation participation)
        => Notification.ForSubmission(participation, "Sara", Action(QuizMasterActionType.SubmitQuiz, StudentId));

    [Fact]
    public void A_parent_hears_that_their_child_finished()
    {
        var notification = Assert.Single(Announce(Submit(Quiz(Choose(1), Choose(2)), [Selected(1, 2), Selected(2, 1)])),
            n => n.RecipientId == ParentId);

        Assert.Equal(NotificationType.SubmissionCompleted, notification.Type);
        Assert.Equal(ParentId, notification.RecipientId);
        Assert.Equal((500, StudentId, "Sara", "Unit 4"), (notification.ParticipationId, notification.ChildId, notification.ChildName, notification.Title));
        Assert.Equal((1, 1, 0), (notification.CorrectCount, notification.WrongCount, notification.PendingReviewCount));
        Assert.False(notification.IsRead);
    }

    [Fact]
    public void The_reviewer_is_told_to_mark_what_only_a_person_can()
    {
        var notifications = Announce(Submit(Quiz(Choose(1), Explain(3)), [Selected(1, 2), Written(3, "<p>Because</p>")]));

        var review = Assert.Single(notifications, n => n.RecipientId == TeacherId);
        Assert.Equal(NotificationType.SubmissionNeedsReview, review.Type);
        Assert.Equal(1, review.PendingReviewCount);
    }

    [Fact]
    public void The_reviewer_hears_about_an_auto_graded_submission_too()
    {
        var notifications = Announce(Submit(Quiz(Choose(1), Choose(2)), [Selected(1, 2), Selected(2, 1)]));

        var received = Assert.Single(notifications, n => n.RecipientId == TeacherId);
        Assert.Equal(NotificationType.SubmissionReceived, received.Type);
        Assert.Equal((1, 1, 0), (received.CorrectCount, received.WrongCount, received.PendingReviewCount));
    }

    [Fact]
    public void A_student_without_a_parent_still_reaches_the_reviewer()
    {
        var orphan = User.Create(1, "uid-orphan", "orphan@school.test", "Orphan", [UserRoleType.STUDENT], Action(QuizMasterActionType.Seed, 0)).WithId(77);
        orphan.PlaceInClass(StudentsClass, Action(QuizMasterActionType.PlaceStudent, AdminId));

        var notification = Assert.Single(Announce(Submit(Quiz(Choose(1)), [Selected(1, 2)], student: orphan)));
        Assert.Equal((NotificationType.SubmissionReceived, TeacherId), (notification.Type, notification.RecipientId));
    }

    [Fact]
    public void An_assignment_is_announced_by_its_title()
        => Assert.All(Announce(Submit(Quiz(Choose(1)), [Selected(1, 2)], Homework(StudentsClass))),
            n => Assert.Equal("Week 1 homework", n.Title));

    [Theory]
    [InlineData(ValidationStatus.Approved, NotificationType.SubmissionApproved)]
    [InlineData(ValidationStatus.Rejected, NotificationType.SubmissionRejected)]
    public void A_verdict_is_announced_to_the_student_with_the_teachers_feedback(ValidationStatus status, NotificationType expected)
    {
        var notification = Assert.Single(Verdict(Submit(Quiz(Choose(1)), [Selected(1, 2)]), status), n => n.RecipientId == StudentId);

        Assert.Equal(expected, notification.Type);
        Assert.Equal("See me", notification.Feedback);
    }

    [Theory]
    [InlineData(ValidationStatus.Approved, NotificationType.ChildSubmissionApproved)]
    [InlineData(ValidationStatus.Rejected, NotificationType.ChildSubmissionRejected)]
    public void The_parent_hears_the_verdict_on_their_childs_work(ValidationStatus status, NotificationType expected)
    {
        var notification = Assert.Single(Verdict(Submit(Quiz(Choose(1)), [Selected(1, 2)]), status), n => n.RecipientId == ParentId);

        Assert.Equal(expected, notification.Type);
        Assert.Equal((StudentId, "Sara", "Unit 4", "See me"), (notification.ChildId, notification.ChildName, notification.Title, notification.Feedback));
    }

    [Fact]
    public void A_student_without_a_parent_alone_hears_the_verdict()
    {
        var orphan = User.Create(1, "uid-orphan", "orphan@school.test", "Orphan", [UserRoleType.STUDENT], Action(QuizMasterActionType.Seed, 0)).WithId(77);
        orphan.PlaceInClass(StudentsClass, Action(QuizMasterActionType.PlaceStudent, AdminId));

        var notification = Assert.Single(Verdict(Submit(Quiz(Choose(1)), [Selected(1, 2)], student: orphan), ValidationStatus.Approved));
        Assert.Equal((NotificationType.SubmissionApproved, 77), (notification.Type, notification.RecipientId));
    }

    private static IReadOnlyList<Notification> Verdict(Participation participation, ValidationStatus status)
    {
        participation.Review([], status, "  See me  ", Action(QuizMasterActionType.ReviewSubmission, TeacherId));
        return Notification.ForVerdict(participation, "Sara", Action(QuizMasterActionType.ReviewSubmission, TeacherId));
    }

    [Fact]
    public void There_is_no_verdict_to_announce_before_a_review()
        => Assert.Throws<DomainException>(() => Notification.ForVerdict(Submit(Quiz(Choose(1)), [Selected(1, 2)]), "Sara",
            Action(QuizMasterActionType.ReviewSubmission, TeacherId)));
}
