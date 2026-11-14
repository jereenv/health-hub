import { previewLines } from './previewLines';

test('headings are lines starting with #, table lines start with |, everything else is ink', () => {
  const { lines } = previewLines('# Title\n> question\n## Summary\n| a | b |\nplain', 10);
  expect(lines.map((l) => l.tone)).toEqual(['heading', 'ink', 'heading', 'muted', 'ink']);
  expect(lines[0]!.text).toBe('# Title');
});

test('max lines are returned and "more" counts the rest; short input has more 0', () => {
  const text = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
  const long = previewLines(text, 12);
  expect(long.lines).toHaveLength(12);
  expect(long.more).toBe(8);
  const short = previewLines('a\nb', 12);
  expect(short.lines).toHaveLength(2);
  expect(short.more).toBe(0);
});

test('blank lines are kept as spacing but are not counted twice', () => {
  const { lines, more } = previewLines('\n\n# T\n\n\n\nbody\n\nlast\n\n', 2);
  expect(lines.map((l) => l.text)).toEqual(['# T', '', 'body']);
  expect(more).toBe(1);
});
