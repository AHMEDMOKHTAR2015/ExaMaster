namespace QuizMaster.Application.Features.Translations.GetTranslationOverrides;

// The caller's school's customised labels, every supported language at once (the client merges both up front so
// switching language never waits). Keys are the dotted paths exactly as the client's JSON spells them.
public record GetTranslationOverridesQuery : IQuery<TranslationOverridesResponse>;

public record TranslationOverridesResponse(IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> Languages);
