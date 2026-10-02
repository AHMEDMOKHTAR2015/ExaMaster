using static QuizMaster.Domain.Tests.TestData;

namespace QuizMaster.Domain.Tests;

// A subject's tags (topics) and the questions tagged with them: a question only ever carries its own subject's tags.
public class SubjectTagTests
{
    private static readonly TestAction ByAdmin = Action(QuizMasterActionType.UpdateSubject, AdminId);

    // Science (1): 11 Space, 12 Matter, 13 Living things. Math (2): 21 Fractions, 22 Geometry.
    private static Subject Science() => SubjectWithTags(1, "Science", "Space", "Matter", "Living things");
    private static Subject Math() => SubjectWithTags(2, "Math", "Fractions", "Geometry");

    private static Subject SubjectWithTags(int id, string name, params string[] tags)
    {
        var subject = Subject.Create(name, null, tags.Select(tag => new SubjectTagDraft(null, tag)).ToList(), ByAdmin).WithId(id);
        for (var i = 0; i < subject.Tags.Count; i++)
            subject.Tags[i].WithId(id * 10 + i + 1);
        return subject;
    }

    private static Question QuestionIn(Subject? subject, params int[] tagIds)
        => Question.Create(
            AuthoredQuestion.From(new QuestionDraft(QuestionType.RightWrong, "The Earth orbits the Sun.", IsRight: true)),
            new QuestionClassification(subject?.Id),
            subject?.TagsFor(tagIds) ?? QuestionTags.None,
            ByAdmin).WithId(500);

    [Fact]
    public void Tag_names_are_trimmed_and_unique_whatever_their_case()
    {
        var subject = Subject.Create("Science", null, [new(null, "  Space ")], ByAdmin);

        Assert.Equal("Space", subject.Tags.Single().Name);
        Assert.Throws<DomainException>(() => Subject.Create("Science", null, [new(null, "Space"), new(null, "space")], ByAdmin));
        Assert.Throws<DomainException>(() => Subject.Create("Science", null, [new(null, " ")], ByAdmin));
    }

    [Fact]
    public void Updating_keeps_renamed_tags_adds_new_ones_and_removes_the_rest()
    {
        var science = Science();

        science.Update("Science", null, [new(11, "Outer space"), new(null, "Energy")], ByAdmin);

        Assert.Equal(["Outer space", "Energy"], science.Tags.Select(tag => tag.Name));
        Assert.Equal(11, science.Tags[0].Id);                      // a renamed tag keeps the questions tagged with it
    }

    [Fact]
    public void Updating_without_a_tag_list_leaves_the_tags_alone()
    {
        var science = Science();

        science.Update("Natural science", null, null, ByAdmin);

        Assert.Equal(3, science.Tags.Count);
    }

    [Fact]
    public void A_subject_refuses_a_tag_id_that_is_not_its_own()
    {
        var science = Science();

        Assert.Throws<DomainException>(() => science.Update("Science", null, [new(21, "Fractions")], ByAdmin));
        Assert.Throws<DomainException>(() => science.TagsFor([11, 21]));
    }

    [Fact]
    public void A_question_carries_tags_of_its_own_subject_only()
    {
        var (science, math) = (Science(), Math());

        Assert.Equal([11, 13], QuestionIn(science, 13, 11, 13).TagIds);
        Assert.Throws<DomainException>(() => Question.Create(
            AuthoredQuestion.From(new QuestionDraft(QuestionType.RightWrong, "1/2 > 1/3", IsRight: true)),
            new QuestionClassification(science.Id), math.TagsFor([21]), ByAdmin));
    }

    [Fact]
    public void A_question_without_a_subject_cannot_be_tagged()
    {
        var question = QuestionIn(null);

        Assert.Throws<DomainException>(() => question.Tag(Science().TagsFor([11]), ByAdmin));
    }

    [Fact]
    public void Moving_a_question_to_another_subject_drops_its_tags()
    {
        var (science, math) = (Science(), Math());
        var (moved, kept) = (QuestionIn(science, 11), QuestionIn(science, 11));

        moved.Reclassify(new QuestionClassification(math.Id), ByAdmin);
        kept.Reclassify(new QuestionClassification(science.Id, StageId: 3), ByAdmin);

        Assert.Empty(moved.TagIds);
        Assert.Equal([11], kept.TagIds);
    }

    [Fact]
    public void Retagging_adds_and_removes_keeping_the_other_tags()
    {
        var science = Science();
        var question = QuestionIn(science, 11, 12);

        question.Retag(science.TagsFor([13]), [12], ByAdmin);

        Assert.Equal([11, 13], question.TagIds);
        Assert.Throws<DomainException>(() => question.Retag(Math().TagsFor([21]), [], ByAdmin));
    }

    [Fact]
    public void Untagging_drops_deleted_tags_from_bank_and_teacher_quiz_questions()
    {
        var science = Science();
        var question = QuestionIn(science, 11, 12);
        var quiz = TeacherQuizIn(science, science.TagsFor([11, 13]));

        question.Untag([12, 13], ByAdmin);
        quiz.Untag([12, 13], ByAdmin);

        Assert.Equal([11], question.TagIds);
        Assert.Equal([11], quiz.Questions.Single().TagIds);
    }

    [Fact]
    public void A_teacher_quiz_question_carries_tags_of_the_quiz_subject_only()
    {
        var (science, math) = (Science(), Math());

        Assert.Equal([12], TeacherQuizIn(science, science.TagsFor([12])).Questions.Single().TagIds);
        Assert.Throws<DomainException>(() => TeacherQuizIn(science, math.TagsFor([21])));
    }

    [Fact]
    public void A_submission_snapshots_each_question_s_tags()
    {
        var quiz = Quiz(Choose(1) with { TagIds = [11, 12] }, Choose(2));

        var participation = Participation.Submit(Student(Class()), quiz, null, null, [Selected(1, 2), Selected(2, 1)], null,
            Action(QuizMasterActionType.SubmitQuiz, StudentId));

        Assert.Equal([11, 12], participation.Answers.Single(answer => answer.QuestionId == 1).TagIds);
        Assert.Empty(participation.Answers.Single(answer => answer.QuestionId == 2).TagIds);
    }

    private static TeacherQuiz TeacherQuizIn(Subject subject, QuestionTags tags)
        => QuizMaster.Domain.TeacherQuizzes.TeacherQuiz.Create("Unit 4", null, QuizSettings.Default, subject, null, null,
            [new TaggedQuestion(AuthoredQuestion.From(new QuestionDraft(QuestionType.Choose, "Pick one", ["A", "B"], CorrectOption: 2)), tags)],
            Action(QuizMasterActionType.CreateTeacherQuiz));
}
