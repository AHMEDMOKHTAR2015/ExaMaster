using System.Text.Json.Serialization;

namespace QuizMaster.Application.Features.Translations.SaveTranslationOverrides;

// One editing session in one language ({language} from the route): Changed labels are set, Removed ones go back to
// the shipped wording. Only the labels named are touched, so a colleague's edits to other labels are never overwritten.
public record SaveTranslationOverridesCommand(Dictionary<string, string>? Changed, List<string>? Removed)
    : QuizMasterCommand<SaveTranslationOverridesResponse>
{
    [JsonIgnore]
    public string Language { get; init; } = "";

    public override QuizMasterActionType ActionType => QuizMasterActionType.SaveTranslationOverrides;
}

public record SaveTranslationOverridesResponse(string Language, IReadOnlyDictionary<string, string> Values);

public class SaveTranslationOverridesCommandValidator : AbstractValidator<SaveTranslationOverridesCommand>
{
    public SaveTranslationOverridesCommandValidator()
    {
        RuleFor(c => c.Language).Must(TranslationOverride.SupportedLanguages.Contains)
            .WithMessage($"Labels can be customised in {string.Join(" and ", TranslationOverride.SupportedLanguages)} only.");
        RuleFor(c => (c.Changed == null ? 0 : c.Changed.Count) + (c.Removed == null ? 0 : c.Removed.Count))
            .InclusiveBetween(1, TranslationOverride.MaxPerLanguage).WithMessage("Change or remove at least one label, and no more than the language has.")
            .OverridePropertyName("changed");
        RuleFor(c => c).Must(c => c.Changed is null || c.Removed is null || !c.Removed.Any(c.Changed.ContainsKey))
            .WithMessage("A label cannot be both changed and removed in the same save.")
            .OverridePropertyName("removed");
    }
}
