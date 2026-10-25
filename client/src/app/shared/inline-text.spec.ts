import { inlineSegments } from './inline-text';

describe('inlineSegments', () => {
  it('splits bold and italic runs out of plain text', () => {
    expect(inlineSegments('Risk size = **Impact × Likelihood** for *different* factors')).toEqual([
      { text: 'Risk size = ', bold: false, italic: false },
      { text: 'Impact × Likelihood', bold: true, italic: false },
      { text: ' for ', bold: false, italic: false },
      { text: 'different', bold: false, italic: true },
      { text: ' factors', bold: false, italic: false }
    ]);
  });

  it('keeps text without markup whole', () => {
    expect(inlineSegments('Plain text')).toEqual([{ text: 'Plain text', bold: false, italic: false }]);
  });

  it('leaves code-like asterisks and unmatched markers as they are', () => {
    expect(inlineSegments('5 * 2 = 10')).toEqual([{ text: '5 * 2 = 10', bold: false, italic: false }]);
    expect(inlineSegments('a ** b')).toEqual([{ text: 'a ** b', bold: false, italic: false }]);
  });

  it('never produces markup: tags in the text stay text', () => {
    const segments = inlineSegments('**<script>alert(1)</script>**');
    expect(segments).toEqual([{ text: '<script>alert(1)</script>', bold: true, italic: false }]);
  });
});
