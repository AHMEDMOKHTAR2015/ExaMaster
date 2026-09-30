namespace QuizMaster.Application.Features.Translations.SaveTranslationOverrides;

public class SaveTranslationOverridesCommandHandler(Repository<TranslationOverride> _translationRepository)
    : IRequestHandler<SaveTranslationOverridesCommand, SaveTranslationOverridesResponse>
{
    public async Task<SaveTranslationOverridesResponse> Handle(SaveTranslationOverridesCommand command, CancellationToken ct)
    {
        var language = TranslationOverride.RequireLanguage(command.Language);
        var changed = command.Changed ?? [];
        var removed = (command.Removed ?? []).ToHashSet();
        var named = changed.Keys.Concat(removed).ToList();

        // only the rows this session names are loaded, and so only they can be written
        var existing = await _translationRepository.Query()
            .Where(translation => translation.Language == language && named.Contains(translation.Key))
            .ToDictionaryAsync(translation => translation.Key, ct);

        foreach (var key in removed)
            if (existing.TryGetValue(key, out var translation))
                _translationRepository.Remove(translation);

        var added = 0;
        foreach (var (key, text) in changed)
        {
            if (existing.TryGetValue(key, out var translation))
                translation.Rewrite(text, command);
            else
            {
                await _translationRepository.AddAsync(TranslationOverride.Create(language, key, text, command), ct);
                added++;
            }
        }

        var total = await _translationRepository.QueryNotTracked().CountAsync(translation => translation.Language == language, ct)
                    + added - removed.Count(existing.ContainsKey);
        if (total > TranslationOverride.MaxPerLanguage)
            throw new BadRequestException($"A school can customise at most {TranslationOverride.MaxPerLanguage} labels per language.");

        await _translationRepository.SaveChangesAsync(ct);          // two sessions adding the same new label: one gets 409

        var values = await _translationRepository.QueryNotTracked()
            .Where(translation => translation.Language == language)
            .ToDictionaryAsync(translation => translation.Key, translation => translation.Text, ct);
        return new SaveTranslationOverridesResponse(language, values);
    }
}
