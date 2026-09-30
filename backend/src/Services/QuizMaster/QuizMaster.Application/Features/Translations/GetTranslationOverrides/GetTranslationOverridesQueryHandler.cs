namespace QuizMaster.Application.Features.Translations.GetTranslationOverrides;

public class GetTranslationOverridesQueryHandler(Repository<TranslationOverride> _translationRepository)
    : IRequestHandler<GetTranslationOverridesQuery, TranslationOverridesResponse>
{
    public async Task<TranslationOverridesResponse> Handle(GetTranslationOverridesQuery query, CancellationToken ct)
    {
        var rows = await _translationRepository.QueryNotTracked()
            .Select(translation => new { translation.Language, translation.Key, translation.Text })
            .ToListAsync(ct);

        // every supported language is present, empty when the school changed nothing in it
        var languages = TranslationOverride.SupportedLanguages.ToDictionary(
            language => language,
            language => (IReadOnlyDictionary<string, string>)rows.Where(row => row.Language == language).ToDictionary(row => row.Key, row => row.Text));

        return new TranslationOverridesResponse(languages);
    }
}
