import { syntheticJourney, syntheticWeek } from './__fixtures__/synthetic';
import { setup } from './__fixtures__/views';
import { buildDailyActivityTable, buildPeriodTable, completedDays } from './dailyTable';

test('completedDays leaves out today', () => {
  expect(completedDays({ from: '2026-11-10', to: '2026-11-12' }, '2026-11-12')).toEqual([
    '2026-11-10',
    '2026-11-11',
  ]);
});

test('daily table has 7 rows; Nov 8 has no steps (–) but has sleep and heart rate; Nov 9 has steps and no sleep', () => {
  const { prep, view } = setup(syntheticWeek());
  const table = buildDailyActivityTable(prep, view, view.window);
  expect(table[0]).toBe(
    '| Date | Steps | Distance (km) | Sleep (night ending that day) | Heart rate min / avg / max |',
  );
  expect(table.filter((line) => /^\| \w{3} \d/.test(line))).toHaveLength(7);
  expect(table).toContain('| Sun 8 Nov | – | – | 7h | 50 / 66 / 120 |');
  expect(table).toContain('| Mon 9 Nov | 10,000 | 8.0 | – | – |');
  expect(table).toContain('| Tue 10 Nov | 7,000 | – | 8h | 54 / 70 / 150 |');
});

test('today row is Thu 12 Nov* and the footnote line is present only when the window includes today', () => {
  const { prep, view } = setup(syntheticWeek());
  const table = buildDailyActivityTable(prep, view, view.window);
  expect(table).toContain('| Thu 12 Nov* | 2,500 | – | 7h 15m | 55 / 72 / 160 |');
  expect(table[table.length - 2]).toBe('');
  expect(table[table.length - 1]).toBe('* today: steps, distance and heart rate so far.');
  const earlier = buildDailyActivityTable(prep, view, { from: '2026-11-06', to: '2026-11-11' });
  expect(earlier.join('\n')).not.toContain('* today');
  expect(earlier.join('\n')).not.toContain('Thu 12 Nov*');
});

test('columns follow the toggles: with activity off there is no Steps or Distance column', () => {
  const { prep, view } = setup(syntheticWeek());
  const table = buildDailyActivityTable(prep, view, view.window, {
    activity: false,
    sleep: true,
    heartRate: true,
  });
  expect(table[0]).toBe('| Date | Sleep (night ending that day) | Heart rate min / avg / max |');
  const sleepOnly = buildDailyActivityTable(prep, view, view.window, {
    activity: false,
    sleep: true,
    heartRate: false,
  });
  expect(sleepOnly[0]).toBe('| Date | Sleep (night ending that day) |');
  // Nothing partial is shown, so there is no star and no footnote.
  expect(sleepOnly.join('\n')).not.toContain('*');
});

test('lb unit headers say miles', () => {
  const { prep, view } = setup(syntheticWeek(), 'week', 'lb');
  expect(buildDailyActivityTable(prep, view, view.window)[0]).toContain('Distance (mi)');
});

test('period table: the week of 2026-11-09 is labelled "(to date)" and uses completed days only', () => {
  const { prep, view } = setup(syntheticWeek());
  const table = buildPeriodTable(prep, view);
  expect(table[0]).toBe(
    '| Week of | Steps/day | Distance/day (km) | Sleep/night | Heart rate avg |',
  );
  // Nov 9, 10, 11 steps: (10000 + 7000 + 9000) / 3; distance 8.0 and 7.0 km; sleep includes today.
  expect(table).toContain('| 2026-11-09 (to date) | 8,667 | 7.5 | 7h 5m | 69 |');
  expect(table).toContain('| 2026-11-02 | 7,000 | 6.0 | 6h 45m | 67 |');
});

test('the period table follows the toggles', () => {
  const { prep, view } = setup(syntheticWeek());
  const table = buildPeriodTable(prep, view, { activity: false, sleep: false, heartRate: true });
  expect(table[0]).toBe('| Week of | Heart rate avg |');
});

test('no cell in any table is 0 for a missing value', () => {
  const data = syntheticJourney();
  data.activity = [];
  data.sleep = [];
  data.heartRate = [];
  const { prep, view } = setup(data, 'week');
  const lines = [
    ...buildDailyActivityTable(prep, view, view.window),
    ...buildPeriodTable(prep, view),
  ].filter(
    (line) => line.startsWith('| ') && !line.startsWith('| Date') && !line.startsWith('| Week'),
  );
  for (const line of lines) {
    const cells = line
      .split('|')
      .slice(2, -1)
      .map((c) => c.trim());
    expect(cells.every((cell) => cell === '–')).toBe(true);
  }
});
