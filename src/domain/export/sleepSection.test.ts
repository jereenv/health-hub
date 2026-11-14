import { syntheticWeek } from './__fixtures__/synthetic';
import { setup } from './__fixtures__/views';
import { buildSleepSection, sleepWeeklyColumns } from './sleepSection';

function section(data = syntheticWeek()) {
  const { prep, view } = setup(data);
  return { prep, view, text: buildSleepSection(prep, view) };
}

test('mean 6h 57m per night over 5 nights with data (2 days skipped); previous 7h over 3 nights; change −3 min', () => {
  expect(section().text.summary).toContain(
    '- Sleep: mean 6h 57m per night over 5 nights with data (2 days without data skipped); previous period 7h (3 nights); change −3 min.',
  );
});

test('the nap on Nov 10 is added to that night: 8h, not 7h 30m', () => {
  const { prep, view } = section();
  expect(sleepWeeklyColumns(prep, view).byWeek.get('2026-11-09')).toEqual(['7h 5m']);
  // (8h + 6h + 7h 15m) / 3 = 7h 5m; the nap makes Nov 10 8h rather than 7h 30m.
});

test('a session ending Nov 12 counts today; a night is dated by its wake day', () => {
  const data = syntheticWeek();
  data.sleep = data.sleep.filter((session) => session.wakeDate === '2026-11-12');
  expect(section(data).text.summary[1]).toContain('mean 7h 15m per night over 1 night with data');
});

test('consistency line appears with at least 3 nights and not with 2', () => {
  expect(
    section().text.summary.some((l) =>
      /^- Typical bedtime \d\d:\d\d, wake \d\d:\d\d, bedtime spread ±\d+ min\.$/.test(l),
    ),
  ).toBe(true);
  const data = syntheticWeek();
  data.sleep = data.sleep.filter((s) => s.wakeDate === '2026-11-11' || s.wakeDate === '2026-11-12');
  expect(section(data).text.summary.some((l) => l.startsWith('- Typical bedtime'))).toBe(false);
});

test('stages are averaged over the nights that have them', () => {
  expect(section().text.summary).toContain(
    '- Average stages per night: light 3h 40m, deep 1h 25m, REM 1h 25m (2 nights with stage data).',
  );
  const data = syntheticWeek();
  data.sleep = data.sleep.map((s) => ({
    ...s,
    hasStages: false,
    lightS: null,
    deepS: null,
    remS: null,
  }));
  expect(section(data).text.summary.some((l) => l.startsWith('- Average stages'))).toBe(false);
});

test('no sleep in the window prints "- Sleep: no data in this period."', () => {
  const data = syntheticWeek();
  data.sleep = [];
  expect(section(data).text.summary).toEqual(['### Sleep', '- Sleep: no data in this period.']);
});

test('no sleep in the previous period is said, not compared', () => {
  const data = syntheticWeek();
  data.sleep = data.sleep.filter((s) => s.wakeDate >= '2026-11-06');
  expect(section(data).text.summary[1]).toContain('; no data in the previous period.');
});

test('the context says a night belongs to the day it ends on and naps are included', () => {
  expect(section().text.context).toEqual([
    '- Sleep: a night belongs to the day it ends on; naps are included.',
  ]);
});
