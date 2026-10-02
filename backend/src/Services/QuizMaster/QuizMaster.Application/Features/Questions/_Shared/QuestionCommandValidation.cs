namespace QuizMaster.Application.Features.Questions.Shared;

// Input shape only (sizes, enums). Whether a question makes sense is the domain's call (AuthoredQuestion).
public static class QuestionCommandValidation
{
    public const int MaxHtmlLength = 600_000;                    // the domain enforces the exact 512 KB byte limit

    public static void AddQuestionContentRules<T>(this AbstractValidator<T> validator,
        System.Linq.Expressions.Expression<Func<T, QuestionType>> type,
        System.Linq.Expressions.Expression<Func<T, string?>> text,
        System.Linq.Expressions.Expression<Func<T, List<string>?>> options,
        System.Linq.Expressions.Expression<Func<T, string?>> subjectHtml,
        System.Linq.Expressions.Expression<Func<T, string?>> referenceAnswer)
    {
        validator.RuleFor(type).IsInEnum();
        validator.RuleFor(text).MaximumLengthWithMessage(AuthoredQuestion.MaxTextLength, "Text");
        validator.RuleFor(options).Must(list => list is null || list.Count <= AuthoredQuestion.MaxOptions)
            .WithMessage($"A question cannot have more than {AuthoredQuestion.MaxOptions} options.");
        validator.RuleFor(subjectHtml).MaximumLengthWithMessage(MaxHtmlLength, "SubjectHtml");
        validator.RuleFor(referenceAnswer).MaximumLengthWithMessage(MaxHtmlLength, "ReferenceAnswer");
    }

    public static void AddQuestionTagRules<T>(this AbstractValidator<T> validator, System.Linq.Expressions.Expression<Func<T, List<int>?>> tagIds)
        => validator.RuleFor(tagIds).Must(list => list is null || list.Count <= Question.MaxTags)
            .WithMessage($"A question cannot have more than {Question.MaxTags} tags.");
}
