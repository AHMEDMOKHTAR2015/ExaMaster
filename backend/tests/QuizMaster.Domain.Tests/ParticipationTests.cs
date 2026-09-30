using static QuizMaster.Domain.Tests.TestData;

namespace QuizMaster.Domain.Tests;

public class ParticipationTests
{
    private static readonly ClassGroup StudentsClass = Class();

    private static Participation Submit(
        AttemptedQuiz quiz, IReadOnlyCollection<QuestionResponse> responses, HomeworkAssignment? homework = null,
        Participation? latest = null, DateTime? claimedStart = null, User? student = null)
        => Participation.Submit(student ?? Student(StudentsClass), quiz, homework, latest, responses, claimedStart,
            Action(QuizMasterActionType.SubmitQuiz, StudentId));

    [Fact]
    public void Submitting_grades_on_the_server_and_snapshots_the_student_and_the_quiz()
    {
        var participation = Submit(Quiz(Choose(1), Choose(2)), [Selected(1, 2), Selected(2, 1)]);

        Assert.Equal(ParticipationType.Quiz, participation.Type);
        Assert.Equal(StudentId, participation.ChildId);
        Assert.Equal(ParentId, participation.ParentId);
        Assert.Equal(StudentsClass.Id, participation.ClassId);
        Assert.Equal(StudentsClass.StageId, participation.StageId);
        Assert.Equal("Unit 4", participation.QuizName);
        Assert.Equal(TeacherId, participation.ReviewerId);     // a bank quiz is reviewed by its reviewer
        Assert.Equal(1, participation.CorrectCount);
        Assert.Equal(50, participation.ScorePercent);
        Assert.Equal(2, participation.Answers.Count);
        Assert.Contains(participation.DomainEvents, e => e is QuizSubmitted);
    }

    [Fact]
    public void An_assignment_is_reviewed_by_its_author()
    {
        var homework = Homework(StudentsClass);

        var participation = Submit(Quiz(Choose(1)) with { ReviewerId = 99 }, [Selected(1, 2)], homework);

        Assert.Equal(ParticipationType.Homework, participation.Type);
        Assert.Equal(homework.CreatedById, participation.ReviewerId);
        Assert.Equal(homework.Id, participation.HomeworkId);
    }

    [Fact]
    public void The_server_stamps_the_end_and_distrusts_an_implausible_start()
    {
        var plausible = Submit(Quiz(Choose(1)), [], claimedStart: Now.AddMinutes(-20));
        var tooOld = Submit(Quiz(Choose(1)), [], claimedStart: Now.AddHours(-13));
        var inTheFuture = Submit(Quiz(Choose(1)), [], claimedStart: Now.AddMinutes(5));

        Assert.Equal(Now, plausible.EndedOn);
        Assert.Equal(Now.AddMinutes(-20), plausible.StartedOn);
        Assert.Equal(Now, tooOld.StartedOn);
        Assert.Equal(Now, inTheFuture.StartedOn);
    }

    [Fact]
    public void RequiredAll_is_enforced_on_the_server()
    {
        var quiz = Quiz(new QuizSettings { RequiredAll = true }, Choose(1), Choose(2));

        Assert.Throws<DomainException>(() => Submit(quiz, [Selected(1, 2)]));
        Assert.NotNull(Submit(quiz, [Selected(1, 2), Selected(2, 2)]));
    }

    [Fact]
    public void A_student_cannot_submit_an_assignment_that_was_not_set_for_them()
    {
        var otherClass = Class(id: 31, gradeId: 21, stageId: 11);
        var outsider = Student(otherClass, OtherStudentId);

        Assert.Throws<DomainException>(() => Submit(Quiz(Choose(1)), [], Homework(StudentsClass), student: outsider));
    }

    [Fact]
    public void Named_students_only_when_an_assignment_names_them()
    {
        var named = Student(StudentsClass);
        var classmate = Student(StudentsClass, OtherStudentId);
        var homework = Homework(StudentsClass, namedStudents: [named]);

        Assert.NotNull(Submit(Quiz(Choose(1)), [], homework, student: named));
        Assert.Throws<DomainException>(() => Submit(Quiz(Choose(1)), [], homework, student: classmate));
    }

    [Fact]
    public void An_assignment_cannot_be_submitted_twice_unless_the_teacher_rejected_the_last_attempt()
    {
        var homework = Homework(StudentsClass);
        var first = Submit(Quiz(Choose(1)), [Selected(1, 1)], homework);

        Assert.Throws<DomainException>(() => Submit(Quiz(Choose(1)), [Selected(1, 2)], homework, latest: first));

        first.Review([], ValidationStatus.Rejected, "Try again", Action(QuizMasterActionType.ReviewSubmission, TeacherId));
        Assert.NotNull(Submit(Quiz(Choose(1)), [Selected(1, 2)], homework, latest: first));
    }

    [Fact]
    public void A_closed_assignment_accepts_no_submissions()
    {
        var homework = Homework(StudentsClass);
        homework.Update(homework.Title, homework.Kind, QuizReference.To(TeacherQuiz()), StudentsClass, null, null, homework.DueAt,
            isActive: false, [], Action(QuizMasterActionType.UpdateAssignment, TeacherId));

        Assert.Throws<DomainException>(() => Submit(Quiz(Choose(1)), [], homework));
    }

    [Fact]
    public void Reviewing_marks_the_pending_answers_and_raises_the_score()
    {
        var participation = Submit(Quiz(Choose(1), Explain(3, weightPercent: 40)), [Selected(1, 2), Written(3, "<p>x</p>")]);
        Assert.Equal(60, participation.ScorePercent);
        Assert.Equal(1, participation.PendingReviewCount);

        participation.Review([new ReviewMark(3, 30, " Good start ")], ValidationStatus.Approved, "Well done",
            Action(QuizMasterActionType.ReviewSubmission, TeacherId));

        var explain = participation.Answers.Single(answer => answer.QuestionId == 3);
        Assert.Equal(90, participation.ScorePercent);
        Assert.Equal(0, participation.PendingReviewCount);
        Assert.Equal(30, explain.EarnedPercent);
        Assert.False(explain.IsCorrect);                       // partial credit is not "correct"
        Assert.Equal("Good start", explain.GradeComment);
        Assert.Equal(ValidationStatus.Approved, participation.ValidationStatus);
        Assert.Equal(TeacherId, participation.ValidatedById);
        Assert.Contains(participation.DomainEvents, e => e is SubmissionReviewed { VerdictChanged: true });
    }

    [Fact]
    public void Full_credit_reads_as_correct()
    {
        var participation = Submit(Quiz(Choose(1), Explain(3, weightPercent: 40)), [Selected(1, 2)]);

        participation.Review([new ReviewMark(3, 40)], ValidationStatus.Approved, null, Action(QuizMasterActionType.ReviewSubmission));

        Assert.True(participation.Answers.Single(answer => answer.QuestionId == 3).IsCorrect);
        Assert.Equal(100, participation.ScorePercent);
    }

    [Fact]
    public void Marks_are_capped_at_the_answers_weight_and_only_apply_to_reviewed_answers()
    {
        var participation = Submit(Quiz(Choose(1), Explain(3, weightPercent: 40)), [Selected(1, 2)]);
        var review = Action(QuizMasterActionType.ReviewSubmission);

        Assert.Throws<DomainException>(() => participation.Review([new ReviewMark(3, 41)], ValidationStatus.Approved, null, review));
        Assert.Throws<DomainException>(() => participation.Review([new ReviewMark(1, 10)], ValidationStatus.Approved, null, review));
        Assert.Throws<DomainException>(() => participation.Review([new ReviewMark(42, 10)], ValidationStatus.Approved, null, review));
    }

    [Fact]
    public void Results_stay_hidden_until_the_assignment_is_due()
    {
        var homework = Homework(StudentsClass, dueAt: Now.AddDays(2));
        var participation = Submit(Quiz(Choose(1)), [Selected(1, 2)], homework);

        Assert.False(participation.AreResultsAvailableTo(homework, Now));
        Assert.True(participation.AreResultsAvailableTo(homework, Now.AddDays(2)));
        Assert.True(participation.AreResultsAvailableTo(null, Now));   // practice quizzes: always
    }
}
