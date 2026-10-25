/** A run of text with the emphasis the document gave it. */
export interface InlineSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

/**
 * Splits the teaching-summary documents' light inline markup (`**bold**`,
 * `*italic*`) into runs the template renders as `<strong>`/`<em>`, so the text
 * never goes through `[innerHTML]`. Anything else, unmatched markers included,
 * stays literal text.
 */
export function inlineSegments(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const pattern = /\*\*(.+?)\*\*|\*([^*\s][^*]*?)\*/gs;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ text: text.slice(last, start), bold: false, italic: false });
    if (match[1] !== undefined) segments.push({ text: match[1], bold: true, italic: false });
    else segments.push({ text: match[2], bold: false, italic: true });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), bold: false, italic: false });
  return segments;
}
