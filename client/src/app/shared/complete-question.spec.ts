import {
  parseCompleteAuthoredText,
  isCompleteParseError,
  renderPreviewText,
  reconstructAuthoredText,
  normalizeCompleteAnswer,
  isCompleteQuestionCorrect,
  CompleteParseSuccess,
} from './complete-question';
import { CompleteSegment } from '../models/question';

function parseOk(raw: string): CompleteParseSuccess {
  const result = parseCompleteAuthoredText(raw);
  if (isCompleteParseError(result)) {
    throw new Error(`expected parse success, got error: ${result.error}`);
  }
  return result;
}

describe('parseCompleteAuthoredText', () => {
  it('parses a single blank with surrounding text', () => {
    const { segments, keywords } = parseOk('The capital of France is Paris(Complete).');
    expect(keywords).toEqual(['Paris']);
    expect(segments).toEqual([
      { kind: 'text', text: 'The capital of France is ' },
      { kind: 'blank', index: 0, expectedLength: 5 },
      { kind: 'text', text: '.' },
    ]);
  });

  it('parses multiple blanks in one passage, indexed in order', () => {
    const { segments, keywords } = parseOk('Water is H(Complete)2O and the sky is blue(Complete).');
    expect(keywords).toEqual(['H', 'blue']);
    const blanks = segments.filter((s): s is Extract<CompleteSegment, { kind: 'blank' }> => s.kind === 'blank');
    expect(blanks.map(b => b.index)).toEqual([0, 1]);
    expect(blanks.map(b => b.expectedLength)).toEqual([1, 4]);
  });

  it('treats consecutive marked words as adjacent blanks (multi-word answer)', () => {
    const { keywords } = parseOk('I live in New(Complete) York(Complete).');
    expect(keywords).toEqual(['New', 'York']);
  });

  it('right-trims unusual spacing before the marker', () => {
    const { segments, keywords } = parseOk('The answer is    Cairo   (Complete)!');
    expect(keywords).toEqual(['Cairo']);
    expect(segments[0]).toEqual({ kind: 'text', text: 'The answer is    ' });
  });

  it('leaves an unmarked repeat of the keyword as plain text', () => {
    const { segments, keywords } = parseOk('Paris and Paris(Complete) differ.');
    expect(keywords).toEqual(['Paris']);
    // Only the second "Paris" becomes a blank; the first stays in the text.
    expect(segments[0]).toEqual({ kind: 'text', text: 'Paris and ' });
    expect(segments.filter(s => s.kind === 'blank').length).toBe(1);
  });

  it('handles a marker at the very start of the passage as a keyword-only blank', () => {
    const { segments, keywords } = parseOk('Paris(Complete) is the capital.');
    expect(keywords).toEqual(['Paris']);
    expect(segments[0]).toEqual({ kind: 'blank', index: 0, expectedLength: 5 });
  });

  it('errors when there are no markers', () => {
    const result = parseCompleteAuthoredText('Just a plain sentence.');
    expect(isCompleteParseError(result) && result.error).toBe('no-markers');
  });

  it('errors when a marker has no preceding word', () => {
    const result = parseCompleteAuthoredText('Paris(Complete)  (Complete) done');
    expect(isCompleteParseError(result) && result.error).toBe('empty-keyword');
  });

  it('is case-sensitive: lowercase (complete) is not a marker', () => {
    const result = parseCompleteAuthoredText('This is (complete) text.');
    expect(isCompleteParseError(result) && result.error).toBe('no-markers');
  });
});

describe('renderPreviewText', () => {
  it('replaces each blank with a fixed placeholder regardless of keyword length', () => {
    const { segments } = parseOk('The capital is Paris(Complete) and water is H(Complete)2O.');
    const preview = renderPreviewText(segments);
    expect(preview).toBe('The capital is _____ and water is _____2O.');
  });
});

describe('reconstructAuthoredText', () => {
  it('round-trips back to parseable text', () => {
    const original = 'The capital of France is Paris(Complete).';
    const { segments, keywords } = parseOk(original);
    const rebuilt = reconstructAuthoredText(segments, keywords);
    expect(rebuilt).toBe(original);
    // And re-parsing the rebuilt text yields the same keywords.
    expect(parseOk(rebuilt).keywords).toEqual(keywords);
  });
});

describe('normalizeCompleteAnswer', () => {
  it('trims and lower-cases', () => {
    expect(normalizeCompleteAnswer('  Paris  ')).toBe('paris');
  });

  it('treats null/undefined as empty string', () => {
    expect(normalizeCompleteAnswer(null)).toBe('');
    expect(normalizeCompleteAnswer(undefined)).toBe('');
  });
});

describe('isCompleteQuestionCorrect', () => {
  it('is correct when every blank matches case-insensitively and trimmed', () => {
    expect(isCompleteQuestionCorrect([
      { answer: 'Paris', userAnswer: ' paris ' },
      { answer: 'H', userAnswer: 'h' },
    ])).toBe(true);
  });

  it('is all-or-nothing: one wrong blank fails the whole question', () => {
    expect(isCompleteQuestionCorrect([
      { answer: 'Paris', userAnswer: 'Paris' },
      { answer: 'blue', userAnswer: 'green' },
    ])).toBe(false);
  });

  it('treats an empty or missing answer as incorrect', () => {
    expect(isCompleteQuestionCorrect([
      { answer: 'Paris', userAnswer: '' },
    ])).toBe(false);
    expect(isCompleteQuestionCorrect([
      { answer: 'Paris' },
    ])).toBe(false);
  });

  it('treats an empty or missing blank list as incorrect', () => {
    expect(isCompleteQuestionCorrect([])).toBe(false);
    expect(isCompleteQuestionCorrect(undefined)).toBe(false);
  });
});
