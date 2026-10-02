namespace QuizMaster.Application.Features.Academic.Shared;

// Input shape only (count, lengths). Unique names and known ids are the domain's call (Subject).
public static class SubjectTagValidation
{
    public static void AddSubjectTagRules<T>(this AbstractValidator<T> validator, System.Linq.Expressions.Expression<Func<T, IEnumerable<SubjectTagDraft>>> tags)
    {
        validator.RuleFor(tags).Must(list => list == null || list.Count() <= Subject.MaxTags)
            .WithMessage($"A subject cannot have more than {Subject.MaxTags} tags.");
        validator.RuleForEach(tags).ChildRules(tag =>
        {
            tag.RuleFor(t => t.Name).NotEmptyWithMessage(nameof(SubjectTagDraft.Name)).MaximumLengthWithMessage(Subject.MaxTagNameLength, nameof(SubjectTagDraft.Name));
            tag.RuleFor(t => t.Id).GreaterThan(0).When(t => t.Id is not null).WithMessageForInvalidId(nameof(SubjectTagDraft.Id));
        });
    }
}
