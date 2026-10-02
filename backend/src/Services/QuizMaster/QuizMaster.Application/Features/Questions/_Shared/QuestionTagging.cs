namespace QuizMaster.Application.Features.Questions.Shared;

// The tags a command names for a bank question, resolved through the question's subject: a tag is only ever reached
// through its subject, so the tenant filter applies and a tag of another subject is refused by Subject.TagsFor.
public static class QuestionTagging
{
    // Loading the subject also checks that it exists.
    public static async Task<QuestionTags> LoadTagsAsync(this SubjectRepository repository, int? subjectId, IReadOnlyCollection<int>? tagIds, CancellationToken ct)
        => TagsFor(await repository.LoadIfSetAsync(subjectId, ct), tagIds);

    public static QuestionTags TagsFor(Subject? subject, IReadOnlyCollection<int>? tagIds)
    {
        if (tagIds is null || tagIds.Count == 0)
            return QuestionTags.None;
        return subject?.TagsFor(tagIds) ?? throw new DomainException("A question needs a subject before it can be tagged.");
    }
}
