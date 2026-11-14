import { expectGolden } from '@/test-support/golden';

import { SYNTHETIC_TODAY, syntheticWeek, workoutOn } from './__fixtures__/synthetic';
import { requestFor } from './__fixtures__/views';
import { buildBriefing } from './buildBriefing';
import { DEFAULT_STARTER } from './starterPrompts';
import type { ExportData, ExportRequest } from './types';

function workoutBriefing(
  workoutId: number | null,
  data: ExportData = syntheticWeek(),
  extra: Partial<ExportRequest> = {},
  unit: 'kg' | 'lb' = 'kg',
) {
  return buildBriefing(
    data,
    requestFor('workout', { workoutId, starter: DEFAULT_STARTER.workout, ...extra }),
    { today: SYNTHETIC_TODAY, unit },
  );
}

test('golden workout.md (Sat 7 Nov): every set, volume, 5 sets, 1 personal record, no weigh-in', () => {
  const b = workoutBriefing(103);
  expectGolden('workout', b.markdown);
  expect(b.title).toBe('Single workout · Upper Strength · Sat 7 Nov 2026');
  for (const text of [
    '# Single workout · Upper Strength · Sat 7 Nov 2026',
    '> Review this workout and tell me what to adjust',
    '- Workout: Upper Strength on Sat 7 Nov (58 min, volume 1.1 t).',
    '- Volume 1.1 t; 5 sets logged; 1 personal record.',
    '- No weigh-in that day.',
    '### Every set',
    '- Bench Press: 80×5, 85×5, 90×3 (PR)',
    '- Pull-up: BW×8, BW×8',
    '### Last time',
    '- Strength:',
  ]) {
    expect(b.markdown).toContain(text);
  }
  expect(b.markdown).not.toContain('Compared with');
  expect(b.csv).toBeNull();
});

test("the Mon 9 Nov workout uses that day's first reading, labelled; with Body off the line is absent", () => {
  const on = workoutBriefing(104).markdown;
  expect(on).toContain(
    "- Weigh-in that day: 83.6 kg (Measured, scale); body fat 23.6 % (Estimated, MovingLife's own figure) — the first reading of the day.",
  );
  const off = workoutBriefing(104, syntheticWeek(), {
    sections: { body: false, workouts: true, activity: true, sleep: true, heartRate: true },
  }).markdown;
  expect(off).not.toContain('Weigh-in');
  expect(off).not.toContain('No weigh-in');
});

test('a day with two readings quotes the first one', () => {
  const data = syntheticWeek();
  data.workouts.push(
    workoutOn(106, '2026-11-08', 'Extra', [{ id: 1, name: 'Bench Press', sets: [[60, 5]] }]),
  );
  const text = workoutBriefing(106, data).markdown;
  expect(text).toContain('- Weigh-in that day: 83.8 kg');
  expect(text).not.toContain('84.6');
});

test('previous night = the sleep ending that day, naps added', () => {
  expect(workoutBriefing(103).markdown).toContain(
    '- Sleep the night before: 6h 30m (night ending Sat 7 Nov); naps included.',
  );
  expect(workoutBriefing(104).markdown).toContain('- No sleep recorded for that night.');
  const data = syntheticWeek();
  data.workouts.push(
    workoutOn(107, '2026-11-10', 'Nap day', [{ id: 1, name: 'Bench Press', sets: [[60, 5]] }]),
  );
  expect(workoutBriefing(107, data).markdown).toContain(
    '- Sleep the night before: 8h (night ending Tue 10 Nov); naps included.',
  );
  const off = workoutBriefing(103, syntheticWeek(), {
    sections: { body: true, workouts: true, activity: true, sleep: false, heartRate: true },
  }).markdown;
  expect(off).not.toContain('Sleep the night before');
  expect(off).not.toContain('No sleep recorded');
});

test('last time: Bench last Mon 2 Nov, top set 85×3, best e1RM 93.5 kg; today 99.2 kg, up 5.7 kg on last time', () => {
  expect(workoutBriefing(103).markdown).toContain(
    '- Bench Press: last time Mon 2 Nov, top set 85×3, best estimated 1RM 93.5 kg; today best estimated 1RM 99.2 kg (+5.7 kg vs last time)',
  );
});

test('first-time exercise says "first time logged"; the Pull-up has no 1RM or PR text anywhere', () => {
  const text = workoutBriefing(104).markdown;
  expect(text).toContain('- Squat: first time logged');
  const pullUp = workoutBriefing(103)
    .markdown.split('\n')
    .filter((l) => l.includes('Pull-up'));
  expect(pullUp).toEqual(['- Pull-up: BW×8, BW×8', '- Pull-up: first time logged']);
  for (const line of pullUp) expect(line).not.toMatch(/1RM|PR|best estimated/);
});

test('a bodyweight exercise with an earlier session lists only its best set', () => {
  const data = syntheticWeek();
  data.workouts.push(
    workoutOn(99, '2026-11-03', 'Pull', [
      {
        id: 2,
        name: 'Pull-up',
        sets: [
          [0, 6],
          [0, 9],
        ],
      },
    ]),
  );
  expect(workoutBriefing(103, data).markdown).toContain(
    '- Pull-up: last time Tue 3 Nov, best set BW×9',
  );
});

test('RIR appears only where set', () => {
  const data = syntheticWeek();
  const bench = data.workouts.find((w) => w.lyftaId === 103)!.exercises[0]!;
  bench.sets[0] = { ...bench.sets[0]!, rir: 2 };
  bench.sets[2] = { ...bench.sets[2]!, rir: 1 };
  expect(workoutBriefing(103, data).markdown).toContain(
    '- Bench Press: 80×5 (RIR 2), 85×5, 90×3 (RIR 1, PR)',
  );
});

test('lb unit prints the sets in pounds', () => {
  expect(workoutBriefing(103, syntheticWeek(), {}, 'lb').markdown).toContain(
    '- Bench Press: 176.4×5, 187.4×5, 198.4×3 (PR)',
  );
});

test('an unknown workout id returns the "no longer stored" briefing', () => {
  expect(workoutBriefing(999).markdown).toBe(
    '# Single workout\n\n- This workout is no longer stored.\n',
  );
  expect(workoutBriefing(null).markdown).toContain('no longer stored');
});
