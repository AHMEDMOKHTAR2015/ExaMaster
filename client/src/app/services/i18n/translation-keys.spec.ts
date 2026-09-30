import {
  extractParams,
  flattenTranslations,
  sanitizeOverrides,
  unflattenOverrides,
  validateOverride,
  MAX_OVERRIDE_LENGTH
} from './translation-keys';

describe('translation-keys', () => {
  describe('flattenTranslations', () => {
    it('flattens nested objects to dotted keys', () => {
      expect(flattenTranslations({ nav: { dashboard: 'Dashboard', users: 'Users' } }))
        .toEqual({ 'nav.dashboard': 'Dashboard', 'nav.users': 'Users' });
    });

    it('keeps keys that contain a hyphen', () => {
      // e.g. notifications.reviewStatus.revision-requested
      expect(flattenTranslations({ a: { 'revision-requested': 'x' } }))
        .toEqual({ 'a.revision-requested': 'x' });
    });

    it('ignores non-string leaves', () => {
      expect(flattenTranslations({ a: 'keep', b: 3, c: null, d: ['x'] })).toEqual({ a: 'keep' });
    });
  });

  describe('unflattenOverrides', () => {
    it('is the inverse of flatten for the shapes we ship', () => {
      const nested = { nav: { dashboard: 'Dashboard', users: 'Users' }, app: { name: 'Q' } };
      expect(unflattenOverrides(flattenTranslations(nested)) as unknown).toEqual(nested);
    });

    it('merges sibling keys under a shared parent', () => {
      expect(unflattenOverrides({ 'a.b': '1', 'a.c': '2' }) as unknown).toEqual({ a: { b: '1', c: '2' } });
    });
  });

  describe('extractParams', () => {
    it('finds tokens with the single optional space the parser allows', () => {
      expect([...extractParams('Hello, {{ name }} and {{count}}')]).toEqual(['name', 'count']);
    });

    it('does NOT treat double-spaced braces as a token', () => {
      // The parser's regex allows at most one space per side, so this reaches
      // the user as literal text. Accepting it here would let the editor
      // approve a label the runtime cannot interpolate.
      expect([...extractParams('Hi {{  name  }}')]).toEqual([]);
    });

    it('reports a repeated token once', () => {
      expect([...extractParams('{{ a }} then {{ a }}')]).toEqual(['a']);
    });
  });

  describe('validateOverride', () => {
    it('accepts a plain replacement', () => {
      expect(validateOverride('Dashboard', 'Homeroom')).toBeNull();
    });

    it('accepts a reworded label that keeps its tokens', () => {
      expect(validateOverride('Hello, {{ name }}', 'Welcome back, {{ name }}!')).toBeNull();
    });

    it('rejects an empty or whitespace-only override', () => {
      expect(validateOverride('Dashboard', '')?.kind).toBe('empty');
      expect(validateOverride('Dashboard', '   ')?.kind).toBe('empty');
    });

    it('rejects an over-long override', () => {
      expect(validateOverride('x', 'y'.repeat(MAX_OVERRIDE_LENGTH + 1))?.kind).toBe('tooLong');
    });

    it('rejects dropping a token the base has', () => {
      // Would silently render "Hello," with no error anywhere.
      const issue = validateOverride('Hello, {{ name }}', 'Hello');
      expect(issue?.kind).toBe('missingParams');
      expect(issue?.params).toEqual(['name']);
    });

    it('rejects inventing a token the base lacks', () => {
      // Renders the literal "{{ foo }}" — the call site passes no params.
      const issue = validateOverride('Hello', 'Hello {{ foo }}');
      expect(issue?.kind).toBe('unknownParams');
      expect(issue?.params).toEqual(['foo']);
    });

    it('allows reordering and repeating tokens', () => {
      expect(validateOverride('{{ a }} of {{ b }}', '{{ b }} / {{ a }} ({{ a }})')).toBeNull();
    });
  });

  describe('sanitizeOverrides', () => {
    const base = { 'nav.dashboard': 'Dashboard', 'topbar.hello': 'Hello, {{ name }}' };

    it('keeps valid entries', () => {
      expect(sanitizeOverrides({ 'nav.dashboard': 'Homeroom' }, base))
        .toEqual({ 'nav.dashboard': 'Homeroom' });
    });

    it('drops keys that no longer exist in the base', () => {
      // A developer deleted the key in a later release; the school still holds
      // an override for it.
      expect(sanitizeOverrides({ 'nav.removed': 'x' }, base)).toEqual({});
    });

    it('drops non-string values', () => {
      // A nested object here would delete a whole namespace via mergeDeep.
      expect(sanitizeOverrides({ 'nav.dashboard': { evil: true } }, base)).toEqual({});
    });

    it('drops values that break interpolation', () => {
      expect(sanitizeOverrides({ 'topbar.hello': 'Hello' }, base)).toEqual({});
    });

    it('handles a missing or empty document', () => {
      expect(sanitizeOverrides(undefined, base)).toEqual({});
      expect(sanitizeOverrides(null, base)).toEqual({});
      expect(sanitizeOverrides({}, base)).toEqual({});
    });
  });
});
