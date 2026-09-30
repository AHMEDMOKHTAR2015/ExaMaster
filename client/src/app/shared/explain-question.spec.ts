/**
 * Pure-function tests for the Explain helpers. No TestBed/DI — the logic is
 * static and deterministic (same approach as `complete-question.spec.ts`).
 */

import {
  MAX_HTML_FIELD_BYTES,
  exceedsHtmlFieldLimit,
  hasExplainResponse,
  plainTextFromHtml,
  summarizeExplainText,
  utf8ByteLength,
  validateExplainAuthoring,
} from './explain-question';

describe('plainTextFromHtml', () => {
  it('strips tags and keeps the text', () => {
    expect(plainTextFromHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('separates block-level elements with a space instead of running them together', () => {
    expect(plainTextFromHtml('<p>one</p><p>two</p>')).toBe('one two');
    expect(plainTextFromHtml('a<br>b')).toBe('a b');
    expect(plainTextFromHtml('<ul><li>x</li><li>y</li></ul>')).toBe('x y');
  });

  it('decodes the entities the editor can emit', () => {
    expect(plainTextFromHtml('a&nbsp;b')).toBe('a b');
    expect(plainTextFromHtml('&lt;tag&gt; &amp; &quot;quoted&quot;')).toBe('<tag> & "quoted"');
  });

  it('collapses whitespace and trims', () => {
    expect(plainTextFromHtml('  <p>  spaced   out  </p>  ')).toBe('spaced out');
  });

  it('returns an empty string for empty input', () => {
    expect(plainTextFromHtml('')).toBe('');
    expect(plainTextFromHtml(null)).toBe('');
    expect(plainTextFromHtml(undefined)).toBe('');
  });

  it('keeps RTL text intact', () => {
    expect(plainTextFromHtml('<p>اشرح عملية التمثيل الضوئي</p>')).toBe('اشرح عملية التمثيل الضوئي');
  });
});

describe('hasExplainResponse', () => {
  it('treats an untouched contenteditable as empty', () => {
    expect(hasExplainResponse('<p><br></p>')).toBe(false);
    expect(hasExplainResponse('<div><br/></div>')).toBe(false);
    expect(hasExplainResponse('')).toBe(false);
    expect(hasExplainResponse(undefined)).toBe(false);
  });

  it('treats whitespace-only markup as empty', () => {
    expect(hasExplainResponse('<p>   </p>')).toBe(false);
    expect(hasExplainResponse('<p>&nbsp;</p>')).toBe(false);
  });

  it('is true once the student writes something', () => {
    expect(hasExplainResponse('<p>Because chlorophyll absorbs light.</p>')).toBe(true);
  });
});

describe('summarizeExplainText', () => {
  it('returns short text unchanged', () => {
    expect(summarizeExplainText('<p>Short answer</p>')).toBe('Short answer');
  });

  it('truncates long text with an ellipsis', () => {
    const summary = summarizeExplainText(`<p>${'a'.repeat(200)}</p>`, 20);
    expect(summary.length).toBe(20);
    expect(summary.endsWith('…')).toBe(true);
  });
});

describe('utf8ByteLength / exceedsHtmlFieldLimit', () => {
  it('counts multi-byte characters by their UTF-8 length', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('ش')).toBe(2);
  });

  it('allows ordinary content and rejects only past the field ceiling', () => {
    expect(exceedsHtmlFieldLimit('<p>a normal answer</p>')).toBe(false);
    expect(exceedsHtmlFieldLimit(null)).toBe(false);
    expect(exceedsHtmlFieldLimit('a'.repeat(MAX_HTML_FIELD_BYTES + 1))).toBe(true);
  });
});

describe('validateExplainAuthoring', () => {
  const valid = {
    subjectHtml: '<p>Explain photosynthesis.</p>',
    referenceAnswer: '<p>Plants convert light into chemical energy.</p>',
    weightPercent: 20,
  };

  it('accepts a well-formed question', () => {
    expect(validateExplainAuthoring(valid)).toBeNull();
  });

  it('rejects an empty subject, including markup-only markup', () => {
    expect(validateExplainAuthoring({ ...valid, subjectHtml: '' })).toBe('empty-subject');
    expect(validateExplainAuthoring({ ...valid, subjectHtml: '<p><br></p>' })).toBe('empty-subject');
  });

  it('rejects an empty reference answer', () => {
    expect(validateExplainAuthoring({ ...valid, referenceAnswer: '   ' })).toBe('empty-answer');
  });

  it('rejects a weight outside 1–100', () => {
    expect(validateExplainAuthoring({ ...valid, weightPercent: 0 })).toBe('invalid-weight');
    expect(validateExplainAuthoring({ ...valid, weightPercent: 101 })).toBe('invalid-weight');
    expect(validateExplainAuthoring({ ...valid, weightPercent: NaN })).toBe('invalid-weight');
  });

  it('rejects content past the HTML field ceiling', () => {
    expect(validateExplainAuthoring({
      ...valid,
      referenceAnswer: 'a'.repeat(MAX_HTML_FIELD_BYTES + 1),
    })).toBe('too-long');
  });
});
