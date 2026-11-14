import { syntheticJourney, syntheticWeek } from './__fixtures__/synthetic';
import { setup } from './__fixtures__/views';
import { buildActivitySection } from './activitySection';

function summary(
  data = syntheticWeek(),
  preset: 'week' | 'journey' = 'week',
  unit: 'kg' | 'lb' = 'kg',
) {
  const { prep, view } = setup(data, preset, unit);
  return buildActivitySection(prep, view).summary;
}

test('steps: mean 8,000 per day over 5 completed days with data (1 day skipped), total 40,000; previous 6,833 per day (6 days); change +1,167', () => {
  expect(summary()).toContain(
    '- Steps: mean 8,000 per day over 5 completed days with data (1 day without data skipped); total 40,000; previous period 6,833 per day (6 days); change +1,167.',
  );
});

test('the null day is skipped, not counted as 0: the mean of [8000, 6000, null, 10000, 7000, 9000] is 8000 not 6667', () => {
  const data = syntheticWeek();
  data.activity = [
    ['2026-11-06', 8000],
    ['2026-11-07', 6000],
    ['2026-11-08', null],
    ['2026-11-09', 10000],
    ['2026-11-10', 7000],
    ['2026-11-11', 9000],
  ].map(([date, steps]) => ({
    date: date as string,
    steps: steps as number | null,
    distanceM: null,
    activeKcal: null,
    totalKcal: null,
  }));
  const line = summary(data).find((l) => l.startsWith('- Steps'))!;
  expect(line).toContain('mean 8,000 per day over 5 completed days with data');
  expect(line).not.toContain('6,667');
});

test("today's 2,500 steps are left out of the mean and the total", () => {
  const line = summary().find((l) => l.startsWith('- Steps'))!;
  expect(line).toContain('total 40,000');
});

test('distance in km: mean 7.0 km over 3 days with data (recorded on 3 of 6 completed days), total 21.0 km', () => {
  expect(summary()).toContain(
    '- Distance: mean 7.0 km per day over 3 days with data (recorded on 3 of 6 completed days); total 21.0 km; previous period 5.5 km per day (2 days); change +1.5 km.',
  );
});

test('distance in miles for lb: mean 4.3 mi, total 13.0 mi', () => {
  const line = summary(syntheticWeek(), 'week', 'lb').find((l) => l.startsWith('- Distance'))!;
  expect(line).toContain('mean 4.3 mi per day over 3 days with data');
  expect(line).toContain('total 13.0 mi');
});

test('active calories are never printed and no total-calorie line appears when no day has it', () => {
  const text = summary().join('\n');
  expect(text).not.toMatch(/active calories|Total calories/i);
});

test('total calories appear (labelled all-day burn) only when a day has them', () => {
  const data = syntheticWeek();
  data.activity = data.activity.map((day) =>
    day.date === '2026-11-09' ? { ...day, totalKcal: 2400 } : day,
  );
  const line = summary(data).find((l) => l.startsWith('- Total calories'))!;
  expect(line).toContain(
    '(all-day burn, not active calories): mean 2,400 kcal per day over 1 completed day with data',
  );
});

test('a metric that is null on every day prints "no data in this period"', () => {
  const data = syntheticWeek();
  data.activity = [];
  expect(summary(data)).toEqual([
    '### Activity',
    '- Steps: no data in this period.',
    '- Distance: no data in this period.',
  ]);
});

test('journey says "journey start" instead of previous', () => {
  const line = summary(syntheticJourney(), 'journey').find((l) => l.startsWith('- Steps'))!;
  expect(line).toContain('in the last 7 days');
  expect(line).toContain('; journey start ');
  expect(line).not.toContain('previous');
});

test('the partial-today line is in the context only when the period includes today', () => {
  const { prep, view } = setup(syntheticWeek());
  expect(buildActivitySection(prep, view).context).toEqual([
    '- Today (Thu 12 Nov) is partial: its steps, distance and heart rate are marked * and left out of averages and totals.',
  ]);
  const past = setup(syntheticWeek(), 'custom', 'kg', {
    custom: { from: '2026-11-02', to: '2026-11-05' },
  });
  expect(buildActivitySection(past.prep, past.view).context).toEqual([]);
});
