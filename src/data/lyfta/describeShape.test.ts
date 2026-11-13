import { describePattern, describeShape } from './describeShape';

test('describes structure without values', () => {
  expect(describeShape({ a: 'secret', b: [{ c: 1 }], d: null, e: true, f: [] })).toEqual({
    a: 'string',
    b: [{ c: 'number' }],
    d: 'null',
    e: 'boolean',
    f: [],
  });
});

test('merges keys across array items', () => {
  expect(describeShape([{ a: 1 }, { b: 'x' }])).toEqual([{ a: 'number', b: 'string' }]);
});

test('reports every type seen for a key across array items', () => {
  expect(describeShape([{ a: 1 }, { a: null }, { a: 2 }])).toEqual([{ a: 'null | number' }]);
});

test('describes undefined', () => {
  expect(describeShape(undefined)).toBe('undefined');
});

test('stops descending past the depth cap', () => {
  let nested: unknown = 'deep';
  for (let i = 0; i < 12; i += 1) nested = { next: nested };
  expect(JSON.stringify(describeShape(nested))).toContain('"…"');
});

test('never includes a value', () => {
  expect(
    JSON.stringify(describeShape({ name: 'hunter2', n: 4242, list: ['hunter2'] })),
  ).not.toMatch(/hunter2|4242/);
});

test('does not repeat a type when merging already merged shapes', () => {
  expect(
    describeShape([
      [{ a: null }, { a: 'x' }],
      [{ a: null }, { a: 'y' }],
    ]),
  ).toEqual([[{ a: 'null | string' }]]);
});

test('collapses value-like keys so ids and dates never print', () => {
  expect(describeShape({ '2026-11-12': { a: 1 }, '2026-11-13': { a: 2, b: 'x' } })).toEqual({
    '<key>': { a: 'number', b: 'string' },
  });
  expect(describeShape({ name: 'x', '1042': true })).toEqual({
    name: 'string',
    '<key>': 'boolean',
  });
  expect(describeShape({ '123e4567-e89b-12d3-a456-426614174000': 1, abcdef0123456789: 2 })).toEqual(
    { '<key>': 'number' },
  );
});

test('re-merging a nullable object keeps one flat union', () => {
  expect(describeShape([[{ a: 1 }, null], [{ b: 'x' }]])).toEqual([
    [{ $union: ['null', { a: 'number', b: 'string' }] }],
  ]);
});

test('a real "$union" key is not mistaken for a union', () => {
  expect(describeShape([{ $union: 1 }, { $union: 'x' }])).toEqual([{ $union: 'number | string' }]);
});

test('merges an empty array with a non-empty one', () => {
  expect(describeShape([[], [{ a: 1 }]])).toEqual([[{ a: 'number' }]]);
});

test('describes a top-level null', () => {
  expect(describeShape(null)).toBe('null');
});

test('never prints a value-like key', () => {
  expect(JSON.stringify(describeShape({ '2026-11-12': 1, '98765': 2 }))).not.toMatch(/2026|98765/);
});

test.each([
  ['01:05:23', '99:99:99'],
  ['2026-11-14', '9999-99-99'],
  ['2026-08-20T17:05:00.000Z', '9999-99-99a99:99:99.999a'],
  ['2026-11-14 10:20:30', '9999-99-99 99:99:99'],
  [null, 'null'],
  [42, 'number'],
  [undefined, 'undefined'],
])('describePattern(%p) = %p', (input, expected) => {
  expect(describePattern(input)).toBe(expected);
});

test('describePattern cuts long strings and never keeps letters or digits', () => {
  const pattern = describePattern('Hunter2 '.repeat(10));
  expect(pattern).toHaveLength(41);
  expect(pattern.endsWith('…')).toBe(true);
  expect(pattern).not.toMatch(/hunter|2/i);
});
