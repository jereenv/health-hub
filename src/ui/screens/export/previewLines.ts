export interface PreviewLine {
  text: string;
  tone: 'heading' | 'muted' | 'ink';
}

function toneOf(text: string): PreviewLine['tone'] {
  if (text.startsWith('#')) return 'heading';
  if (text.startsWith('|')) return 'muted';
  return 'ink';
}

/**
 * The first `max` non-blank lines of the briefing for the Preview card. Blank lines stay as
 * spacing (a run of them collapses to one, and none lead or trail) but are not counted;
 * `more` is the number of non-blank lines left out.
 */
export function previewLines(
  markdown: string,
  max: number,
): { lines: PreviewLine[]; more: number } {
  const lines: PreviewLine[] = [];
  let shown = 0;
  let more = 0;
  for (const raw of markdown.split(/\r?\n/)) {
    const text = raw.trimEnd();
    if (text.trim() === '') {
      const last = lines[lines.length - 1];
      if (shown < max && last !== undefined && last.text !== '') {
        lines.push({ text: '', tone: 'ink' });
      }
    } else if (shown < max) {
      lines.push({ text, tone: toneOf(text) });
      shown += 1;
    } else {
      more += 1;
    }
  }
  while (lines.length > 0 && lines[lines.length - 1]!.text === '') lines.pop();
  return { lines, more };
}
