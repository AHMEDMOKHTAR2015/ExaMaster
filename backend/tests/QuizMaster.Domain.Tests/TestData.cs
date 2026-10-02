using System.Reflection;
using Blocks.Entities;

namespace QuizMaster.Domain.Tests;

public sealed record TestAction(QuizMasterActionType ActionType, DateTime CreatedOn, int CreatedById = TestData.TeacherId, string? Comment = null)
    : IQuizMasterAction
{
    public int AggregateId => 0;
    public int CreatedById { get; set; } = CreatedById;
    public string Action => ActionType.ToString();
}

// A question as the grader sees it, without a database.
public sealed record TestQuestion(
    int QuestionId,
    QuestionType Type,
    string Name,
    IReadOnlyList<QuestionOption> Options,
    IReadOnlyList<CompleteSegment> Segments,
    AnswerKey Key,
    string? SubjectHtml = null,
    double? WeightPercent = null,
    int? DurationSeconds = null) : IQuestionDefinition
{
    public IReadOnlyList<int> TagIds { get; init; } = [];
}

public static class TestData
{
    public const int AdminId = 1;
    public const int TeacherId = 2;
    public const int StudentId = 3;
    public const int ParentId = 4;
    public const int OtherStudentId = 5;

    public static readonly DateTime Now = new(2026, 9, 27, 10, 0, 0, DateTimeKind.Utc);

    public static TestAction Action(QuizMasterActionType type, int byUserId = TeacherId, DateTime? on = null)
        => new(type, on ?? Now, byUserId);

    // Entities have init-only ids assigned by the database; tests set them the same way EF does.
    public static T WithId<T>(this T entity, int id) where T : Entity<int>
    {
        typeof(Entity<int>).GetProperty(nameof(Entity<int>.Id), BindingFlags.Public | BindingFlags.Instance)!.SetValue(entity, id);
        return entity;
    }

    // ---- questions ----

    public static TestQuestion Choose(int id = 1, int correctOptionId = 2)
        => new(id, QuestionType.Choose, "Pick one", [new(1, "A"), new(2, "B")], [], new AnswerKey(correctOptionId, null, null));

    public static TestQuestion RightWrong(int id = 1, bool isRight = true)
        => new(id, QuestionType.RightWrong, "The Earth orbits the Sun.", RightWrongOptions.All, [],
            new AnswerKey(RightWrongOptions.CorrectOptionId(isRight), null, null));

    public static TestQuestion Complete(int id = 2, params string[] keywords)
    {
        keywords = keywords.Length == 0 ? ["Paris"] : keywords;
        var segments = new List<CompleteSegment> { CompleteSegment.ForText("The answer is ") };
        segments.AddRange(keywords.Select((keyword, i) => CompleteSegment.ForBlank(i, keyword.Length)));
        return new(id, QuestionType.Complete, "The answer is _____", [], segments, new AnswerKey(null, keywords, null));
    }

    public static TestQuestion Explain(int id = 3, double? weightPercent = 30)
        => new(id, QuestionType.Explain, "Explain photosynthesis.", [], [],
            new AnswerKey(null, null, "<p>Plants convert light into chemical energy.</p>"),
            SubjectHtml: "<p>Explain <b>photosynthesis</b>.</p>", WeightPercent: weightPercent);

    public static QuestionResponse Selected(int questionId, int optionId) => new(questionId, SelectedOptionId: optionId);

    public static QuestionResponse Typed(int questionId, params string?[] blanks)
        => new(questionId, Blanks: blanks.Select((answer, i) => new BlankResponse(i, answer)).ToList());

    public static QuestionResponse Written(int questionId, string html) => new(questionId, ResponseText: html);

    // ---- people and places ----

    public static User Admin()
        => User.Create(1, "uid-admin", "admin@school.test", "Admin", [UserRoleType.APPLICATION_ADMIN], Action(QuizMasterActionType.Seed, 0)).WithId(AdminId);

    public static User Teacher(int id = TeacherId)
        => User.Create(1, $"uid-teacher-{id}", $"teacher{id}@school.test", "Teacher", [UserRoleType.TEACHER], Action(QuizMasterActionType.Seed, 0)).WithId(id);

    public static User Parent()
        => User.Create(1, "uid-parent", "parent@school.test", "Parent", [UserRoleType.PARENT], Action(QuizMasterActionType.Seed, 0)).WithId(ParentId);

    public static User Student(ClassGroup classGroup, int id = StudentId)
    {
        var student = User.Create(1, $"uid-student-{id}", $"student{id}@school.test", "Student", [UserRoleType.STUDENT], Action(QuizMasterActionType.Seed, 0)).WithId(id);
        student.PlaceInClass(classGroup, Action(QuizMasterActionType.PlaceStudent, AdminId));
        student.LinkToParent(Parent(), Action(QuizMasterActionType.PlaceStudent, AdminId));
        return student;
    }

    public static ClassGroup Class(int id = 30, int gradeId = 20, int stageId = 10)
    {
        var stage = Stage.Create("Primary", 1, Action(QuizMasterActionType.CreateStage, AdminId)).WithId(stageId);
        var grade = Grade.Create(stage, "Grade 1", 1, Action(QuizMasterActionType.CreateGrade, AdminId)).WithId(gradeId);
        return ClassGroup.Create(grade, $"Class {id}", [], [], Action(QuizMasterActionType.CreateClass, AdminId)).WithId(id);
    }

    public static AttemptedQuiz Quiz(params IQuestionDefinition[] questions)
        => new(BankQuizId: 100, TeacherQuizId: null, "Unit 4", QuizSettings.Default, ReviewerId: TeacherId, questions);

    public static AttemptedQuiz Quiz(QuizSettings settings, params IQuestionDefinition[] questions)
        => new(BankQuizId: 100, TeacherQuizId: null, "Unit 4", settings, ReviewerId: TeacherId, questions);

    public static TeacherQuiz TeacherQuiz(int id = 200)
    {
        var subject = Subject.Create("Science", null, [], Action(QuizMasterActionType.CreateSubject, AdminId)).WithId(40);
        var question = AuthoredQuestion.From(new QuestionDraft(QuestionType.Choose, "Pick one", ["A", "B"], CorrectOption: 2));
        return QuizMaster.Domain.TeacherQuizzes.TeacherQuiz.Create(
            "Unit 4", null, QuizSettings.Default, subject, null, null, [new TaggedQuestion(question, QuestionTags.None)], Action(QuizMasterActionType.CreateTeacherQuiz)).WithId(id);
    }

    public static HomeworkAssignment Homework(ClassGroup classGroup, DateTime? dueAt = null, IReadOnlyCollection<User>? namedStudents = null, int id = 300)
        => HomeworkAssignment.Create(
            "Week 1 homework", AssignmentKind.Homework, QuizReference.To(TeacherQuiz()), classGroup, null, null,
            dueAt ?? Now.AddDays(7), namedStudents ?? [], Action(QuizMasterActionType.CreateAssignment, TeacherId, Now.AddDays(-1))).WithId(id);
}
