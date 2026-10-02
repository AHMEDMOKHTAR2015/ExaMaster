namespace QuizMaster.Domain.Questions;

// Tags chosen for a question, all of one subject. Only Subject.TagsFor builds one with tags in it, so a question
// can never be handed a tag its subject does not have.
public sealed class QuestionTags
{
    public static readonly QuestionTags None = new(null, []);

    internal QuestionTags(int? subjectId, IReadOnlyList<int> tagIds) => (SubjectId, TagIds) = (subjectId, tagIds);

    public int? SubjectId { get; }
    public IReadOnlyList<int> TagIds { get; }

    public bool IsEmpty => TagIds.Count == 0;
}

// A question as authored, with the tags it was given (a teacher quiz's questions arrive this way).
public sealed record TaggedQuestion(AuthoredQuestion Question, QuestionTags Tags);
