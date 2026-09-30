using System.Text.Json.Serialization;

namespace QuizMaster.Application.Features.Translations.ResetTranslationOverrides;

// Every customised label in one language ({language} from the route) goes back to the shipped wording.
public record ResetTranslationOverridesCommand : QuizMasterCommand<ResetTranslationOverridesResponse>
{
    [JsonIgnore]
    public string Language { get; init; } = "";

    public override QuizMasterActionType ActionType => QuizMasterActionType.ResetTranslationOverrides;
}

public record ResetTranslationOverridesResponse(string Language, int RemovedCount);

public class ResetTranslationOverridesCommandValidator : AbstractValidator<ResetTranslationOverridesCommand>
{
    public ResetTranslationOverridesCommandValidator()
    {
        RuleFor(c => c.Language).Must(TranslationOverride.SupportedLanguages.Contains)
            .WithMessage($"Labels can be customised in {string.Join(" and ", TranslationOverride.SupportedLanguages)} only.");
    }
}
