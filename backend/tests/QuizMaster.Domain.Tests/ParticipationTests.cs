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

    // A quiz of `autoCount` Choose questions (all answered correctly) followed by `completeCount` Complete questions:
    // the shape of a real teacher quiz, whose shares of 100% are rarely whole numbers.
    private static Participation SubmitAutoAndComplete(int autoCount, int completeCount)
    {
        var questions = Enumerable.Range(1, autoCount).Select(id => (IQuestionDefinition)Choose(id))
            .Concat(Enumerable.Range(autoCount + 1, completeCount).Select(id => (IQuestionDefinition)Complete(id, "Paris")))
            .ToArray();
        var responses = Enumerable.Range(1, autoCount).Select(id => Selected(id, 2))
            .Concat(Enumerable.Range(autoCount + 1, completeCount).Select(id => Typed(id, "Paris")))
            .ToList();
        return Submit(Quiz(questions), responses);
    }

    private static void MarkEveryReviewedAnswer(Participation participation, Func<ParticipationAnswer, double> mark)
        => participation.Review(
            participation.Answers.Where(answer => answer.RequiresReview).Select(answer => new ReviewMark(answer.QuestionId, mark(answer))).ToList(),
            ValidationStatus.Approved, null, Action(QuizMasterActionType.ReviewSubmission, TeacherId));

    [Fact]
    public void Full_marks_on_every_answer_score_100_when_shares_round_down()
    {
        // 29 questions: each is worth 3.45%, and a teacher marks out of 3. Points used to count as percent: 94%.
        var participation = SubmitAutoAndComplete(autoCount: 16, completeCount: 13);

        MarkEveryReviewedAnswer(participation, answer => answer.MaxAward);

        Assert.Equal(3, participation.Answers.First(answer => answer.RequiresReview).MaxAward);
        Assert.Equal(100, participation.ScorePercent);
    }

    [Fact]
    public void Full_marks_on_every_answer_score_100_when_shares_round_up()
    {
        // 40 questions: each is worth 2.5%, and a teacher marks out of 3. Points used to count as percent: 112%.
        var participation = SubmitAutoAndComplete(autoCount: 16, completeCount: 24);

        MarkEveryReviewedAnswer(participation, answer => answer.MaxAward);

        Assert.Equal(3, participation.Answers.First(answer => answer.RequiresReview).MaxAward);
        Assert.Equal(100, participation.ScorePercent);
    }

    [Fact]
    public void A_mark_earns_its_proportion_of_the_answers_real_share()
    {
        var participation = SubmitAutoAndComplete(autoCount: 16, completeCount: 13);

        // 2 of 3 points on a 3.45% question earns two thirds of 3.45%, not 2%
        MarkEveryReviewedAnswer(participation, answer => answer.QuestionId == 17 ? 2 : answer.MaxAward);

        var marked = participation.Answers.Single(answer => answer.QuestionId == 17);
        Assert.Equal(2, marked.AwardedPercent);                         // the teacher's points are kept as given
        Assert.Equal(100.0 / 29 * 2 / 3, marked.EarnedPercent!.Value, precision: 9);
        Assert.False(marked.IsCorrect);
        Assert.Equal(99, participation.ScorePercent);                   // 100 − 1.15 = 98.85
    }

    [Fact]
    public void A_zero_mark_earns_nothing_and_the_rest_of_the_quiz_still_counts_in_full()
    {
        var participation = SubmitAutoAndComplete(autoCount: 16, completeCount: 13);

        MarkEveryReviewedAnswer(participation, answer => answer.QuestionId == 17 ? 0 : answer.MaxAward);

        Assert.Equal(97, participation.ScorePercent);                   // 28 of 29 questions: 96.55
    }

    [Fact]
    public void Marks_cannot_exceed_the_answers_maximum_points()
    {
        var participation = SubmitAutoAndComplete(autoCount: 16, completeCount: 13);

        Assert.Throws<DomainException>(() => MarkEveryReviewedAnswer(participation, _ => 4));
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
