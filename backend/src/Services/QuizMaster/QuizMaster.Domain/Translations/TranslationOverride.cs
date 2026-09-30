namespace QuizMaster.Domain.Translations;

// One label a school has reworded, in one language: "nav.dashboard" in "ar" reads "…" here.
//insight - a row per label, not one document per language: two administrators saving different labels at the same
// time both land, and the same label is simply last-write-wins
// The shipped assets/i18n/{lang}.json in the client stay the base and the only list of which keys exist. The client
// still sanitizes every override at merge time (unknown key, lost or invented {{ token }}), because only it has the base.
public partial class TranslationOverride : AggregateRoot, IMultitenancy
{
    private TranslationOverride() {}                             // use TranslationOverride.Create(...)

    public int TenantId { get; set; }
    public string Language { get; private set; } = null!;        // "en" | "ar"
    public string Key { get; private set; } = null!;             // dotted path, e.g. "nav.dashboard"
    public string Text { get; private set; } = null!;
}
