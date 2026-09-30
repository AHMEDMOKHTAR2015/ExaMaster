namespace QuizMaster.Application.Features.Translations.ResetTranslationOverrides;

public class ResetTranslationOverridesCommandHandler(Repository<TranslationOverride> _translationRepository)
    : IRequestHandler<ResetTranslationOverridesCommand, ResetTranslationOverridesResponse>
{
    // One set-based DELETE; the tenant filter keeps it to the caller's school.
    public async Task<ResetTranslationOverridesResponse> Handle(ResetTranslationOverridesCommand command, CancellationToken ct)
    {
        var removed = await _translationRepository.Query()
            .Where(translation => translation.Language == command.Language)
            .ExecuteDeleteAsync(ct);

        return new ResetTranslationOverridesResponse(command.Language, removed);
    }
}
