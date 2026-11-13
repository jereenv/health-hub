import { describeShape } from './describeShape';

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
