using static QuizMaster.Domain.Tests.TestData;

namespace QuizMaster.Domain.Tests;

// Rules of the smaller aggregates: users, bank quizzes, teacher quizzes, assignments.
public class AggregateRulesTests
{
    private static readonly ClassGroup StudentsClass = Class();

    [Fact]
    public void A_student_account_cannot_also_hold_staff_or_parent_roles()
        => Assert.Throws<DomainException>(() => Admin().AssignRoles(
            [UserRoleType.STUDENT, UserRoleType.TEACHER], Action(QuizMasterActionType.AssignUserRoles, AdminId)));

    [Fact]
    public void A_tenant_administrator_cannot_hand_out_the_platform_role()
        => Assert.Throws<DomainException>(() => Teacher().AssignRoles(
            [UserRoleType.PLATFORM_ADMIN], Action(QuizMasterActionType.AssignUserRoles, AdminId)));

    [Fact]
    public void An_administrator_cannot_remove_their_own_admin_role_or_deactivate_themselves()
    {
        var admin = Admin();

        Assert.Throws<DomainException>(() => admin.AssignRoles([UserRoleType.TEACHER], Action(QuizMasterActionType.AssignUserRoles, AdminId)));
        Assert.Throws<DomainException>(() => admin.Deactivate(Action(QuizMasterActionType.DeactivateUser, AdminId)));
    }

    [Fact]
    public void Placement_comes_from_the_class_and_only_applies_to_students()
    {
        var student = Student(StudentsClass);

        Assert.Equal((StudentsClass.StageId, StudentsClass.GradeId, StudentsClass.Id), (student.StageId!.Value, student.GradeId, student.ClassId!.Value));
        Assert.Throws<DomainException>(() => Teacher().PlaceInClass(StudentsClass, Action(QuizMasterActionType.PlaceStudent, AdminId)));
    }

    [Fact]
    public void Losing_the_student_role_clears_the_placement()
    {
        var student = Student(StudentsClass);

        student.AssignRoles([UserRoleType.PARENT], Action(QuizMasterActionType.AssignUserRoles, AdminId));

        Assert.Null(student.ClassId);
    }

    private static Question BankQuestion(int id, QuestionDraft draft)
        => Question.Create(AuthoredQuestion.From(draft), QuestionClassification.None, QuestionTags.None, Action(QuizMasterActionType.CreateQuestion, AdminId)).WithId(id);

    private static readonly QuestionDraft ChooseDraft = new(QuestionType.Choose, "Pick", ["A", "B"], CorrectOption: 1);
    private static QuestionDraft ExplainDraft(double weight) => new(QuestionType.Explain, SubjectHtml: "<p>Why?</p>", ReferenceAnswer: "<p>x</p>", WeightPercent: weight);

    [Fact]
    public void A_bank_quiz_needs_an_active_teacher_as_reviewer()
    {
        var questions = new[] { BankQuestion(1, ChooseDraft) };

        Assert.Throws<DomainException>(() => BankQuiz.Create("Quiz", null, QuizSettings.Default, QuizPlacement.Open, Parent(), questions,
            Action(QuizMasterActionType.CreateQuiz, AdminId)));
        Assert.NotNull(BankQuiz.Create("Quiz", null, QuizSettings.Default, QuizPlacement.Open, Teacher(), questions,
            Action(QuizMasterActionType.CreateQuiz, AdminId)));
    }

    [Fact]
    public void A_bank_quiz_rejects_explain_weights_that_leave_nothing_for_the_other_questions()
        => Assert.Throws<DomainException>(() => BankQuiz.Create("Quiz", null, QuizSettings.Default, QuizPlacement.Open, Teacher(),
            [BankQuestion(1, ChooseDraft), BankQuestion(2, ExplainDraft(100))], Action(QuizMasterActionType.CreateQuiz, AdminId)));

    [Fact]
    public void A_bank_quiz_is_sat_in_its_stored_order_skipping_deleted_questions()
    {
        var first = BankQuestion(1, ChooseDraft);
        var second = BankQuestion(2, ChooseDraft);
        var third = BankQuestion(3, ChooseDraft);
        var quiz = BankQuiz.Create("Quiz", null, QuizSettings.Default, QuizPlacement.Open, Teacher(), [third, first, second],
            Action(QuizMasterActionType.CreateQuiz, AdminId)).WithId(100);

        var attempted = quiz.ForAttempt([first, third]);       // question 2 was deleted from the bank since

        Assert.Equal([3, 1], attempted.Questions.Select(question => question.QuestionId));
        Assert.Equal(TeacherId, attempted.ReviewerId);
    }

    [Fact]
    public void Teacher_quiz_questions_are_numbered_so_responses_survive_an_edit()
    {
        var quiz = TeacherQuiz();

        Assert.Equal([1], quiz.ForAttempt().Questions.Select(question => question.QuestionId));
        Assert.True(quiz.IsOwnedBy(TeacherId));
        Assert.Null(quiz.ForAttempt().ReviewerId);            // its assignment's author reviews it
    }

    [Fact]
    public void An_assignment_takes_its_stage_from_the_class_and_needs_a_future_due_date()
    {
        var homework = Homework(StudentsClass);

        Assert.Equal(StudentsClass.StageId, homework.StageId);
        Assert.Throws<DomainException>(() => HomeworkAssignment.Create("Late", AssignmentKind.Homework, QuizReference.To(TeacherQuiz()),
            StudentsClass, null, null, Now.AddMinutes(-1), [], Action(QuizMasterActionType.CreateAssignment)));
    }

    [Fact]
    public void Named_students_must_belong_to_the_assigned_class()
    {
        var elsewhere = Student(Class(id: 31, gradeId: 21, stageId: 11), OtherStudentId);

        Assert.Throws<DomainException>(() => Homework(StudentsClass, namedStudents: [elsewhere]));
    }

    [Fact]
    public void The_whole_stage_can_submit_an_assignment_that_names_nobody()
    {
        var sameStageOtherClass = Student(Class(id: 32), OtherStudentId);

        Assert.True(Homework(StudentsClass).IsAssignedTo(sameStageOtherClass));
    }
}
