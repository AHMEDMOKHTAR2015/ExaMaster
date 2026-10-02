namespace QuizMaster.Domain.Academic;

public partial class Subject
{
    public const int MaxTags = 200;
    public const int MaxTagNameLength = MaxLength.C64;

    public static Subject Create(string name, string? color, IReadOnlyList<SubjectTagDraft> tags, IQuizMasterAction action)
    {
        var subject = new Subject { CreatedById = action.CreatedById, CreatedOn = action.CreatedOn };
        subject.Apply(name, color);
        subject.ApplyTags(tags);
        return subject;
    }

    // Tags left out of the list are removed (the caller drops them from the questions that carry them, in the same
    // commit); null leaves the tags as they are.
    public void Update(string name, string? color, IReadOnlyList<SubjectTagDraft>? tags, IQuizMasterAction action)
    {
        Apply(name, color);
        if (tags is not null)
            ApplyTags(tags);
        (LastModifiedById, LastModifiedOn) = (action.CreatedById, action.CreatedOn);
    }

    // The tags a question of this subject is given; any id that is not one of this subject's tags is refused.
    public QuestionTags TagsFor(IReadOnlyCollection<int> tagIds)
    {
        var unknown = tagIds.Distinct().Except(_tags.Select(tag => tag.Id)).ToList();
        if (unknown.Count > 0)
            throw new DomainException($"Tag {string.Join(", ", unknown)} is not one of {Name}'s tags.");

        return new QuestionTags(Id, tagIds.Distinct().Order().ToList());
    }

    private void Apply(string name, string? color)
    {
        if (!string.IsNullOrWhiteSpace(color) && !AcademicRules.HexColor.IsMatch(color.Trim()))
            throw new DomainException("A subject colour must be written as #RRGGBB.");

        (Name, Color) = (AcademicRules.RequiredName(name), string.IsNullOrWhiteSpace(color) ? null : color.Trim());
    }

    //insight - a kept tag keeps its id, so renaming it ("Fraction" → "Fractions") keeps every question tagged with it
    private void ApplyTags(IReadOnlyList<SubjectTagDraft> tags)
    {
        if (tags.Count > MaxTags)
            throw new DomainException($"A subject cannot have more than {MaxTags} tags.");

        var names = tags.Select(tag => RequiredTagName(tag.Name)).ToList();
        var repeated = names.GroupBy(tagName => tagName, StringComparer.OrdinalIgnoreCase).FirstOrDefault(group => group.Count() > 1);
        if (repeated is not null)
            throw new DomainException($"The tag \"{repeated.Key}\" appears more than once.");

        var keptIds = tags.Where(tag => tag.Id is not null).Select(tag => tag.Id!.Value).ToList();
        if (keptIds.Distinct().Count() != keptIds.Count)
            throw new DomainException("A tag can appear only once.");
        var unknown = keptIds.Except(_tags.Select(tag => tag.Id)).ToList();
        if (unknown.Count > 0)
            throw new DomainException($"Tag {string.Join(", ", unknown)} is not one of {Name}'s tags.");

        _tags.RemoveAll(tag => !keptIds.Contains(tag.Id));
        for (var i = 0; i < tags.Count; i++)
        {
            if (tags[i].Id is { } id)
                _tags.Single(tag => tag.Id == id).Rename(names[i]);
            else
                _tags.Add(SubjectTag.Create(names[i]));
        }
    }

    private static string RequiredTagName(string name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed))
            throw new DomainException("A tag needs a name.");
        if (trimmed.Length > MaxTagNameLength)
            throw new DomainException($"A tag name cannot exceed {MaxTagNameLength} characters.");
        return trimmed;
    }
}
