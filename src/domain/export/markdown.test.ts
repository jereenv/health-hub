import * as fs from 'fs';
import * as path from 'path';

import { expectGolden } from '@/test-support/golden';

import { MISSING, dayLabel, formatSignedInteger, mdTable, mean } from './markdown';

test('mdTable pads nothing, escapes pipes in cells, and emits the separator row', () => {
  expect(mdTable(['A', 'B'], [['1', 'x|y']])).toEqual(['| A | B |', '|---|---|', '| 1 | x\\|y |']);
  expect(mdTable(['A'], [])).toEqual(['| A |', '|---|']);
  expect(MISSING).toBe('–');
});

test('mean of an empty list is null, never 0 or NaN', () => {
  expect(mean([])).toBeNull();
  expect(mean([2, 4])).toBe(3);
});

test('dayLabel is "Fri 6 Nov" and gets a trailing * for today', () => {
  expect(dayLabel('2026-11-06', '2026-11-12')).toBe('Fri 6 Nov');
  expect(dayLabel('2026-11-12', '2026-11-12')).toBe('Thu 12 Nov*');
});

test('formatSignedInteger groups thousands and uses the true minus', () => {
  expect(formatSignedInteger(1166.67)).toBe('+1,167');
  expect(formatSignedInteger(-3)).toBe('−3');
  expect(formatSignedInteger(0.2)).toBe('0');
});

describe('expectGolden', () => {
  const name = '__golden-selftest';
  const file = path.join(__dirname, '__golden__', `${name}.md`);
  const previousFlag = process.env.UPDATE_GOLDEN;

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.UPDATE_GOLDEN;
    else process.env.UPDATE_GOLDEN = previousFlag;
    fs.rmSync(file, { force: true });
  });

  test('fails on a missing file and on a difference, and rewrites with UPDATE_GOLDEN=1', () => {
    delete process.env.UPDATE_GOLDEN;
    expect(() => expectGolden(name, 'one\n')).toThrow('missing');

    process.env.UPDATE_GOLDEN = '1';
    expectGolden(name, 'one\n');
    expect(fs.readFileSync(file, 'utf8')).toBe('one\n');

    delete process.env.UPDATE_GOLDEN;
    expect(() => expectGolden(name, 'one\n')).not.toThrow();
    expect(() => expectGolden(name, 'two\n')).toThrow();
  });
});
