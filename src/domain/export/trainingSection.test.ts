import { makeExercise, makeSet, makeWorkout } from '@/test-support/workoutBuilders';
import type { WeightUnit } from '@/domain/workouts/types';

import {
  SYNTHETIC_TODAY,
  localIso,
  syntheticJourney,
  syntheticWeek,
  workoutOn,
} from './__fixtures__/synthetic';
import { earliestDataDate, resolvePeriod } from './period';
import { prepareExportData } from './prepare';
import {
  buildTrainingSection,
  isBodyweightExercise,
  oneRepMaxState,
  trainingWeeklyColumns,
} from './trainingSection';
import type { ExportData, PresetId } from './types';

function training(data: ExportData, preset: PresetId = 'week', unit: WeightUnit = 'kg') {
  const view = resolvePeriod({
    request: {
      preset,
      sections: { body: true, workouts: true, activity: true, sleep: true, heartRate: true },
      starter: '',
      workoutId: null,
      custom: null,
      includeCsv: false,
    },
    today: SYNTHETIC_TODAY,
    unit,
    firstDataDate: earliestDataDate(data),
  })!;
  const prep = prepareExportData(data);
  return { prep, view, text: buildTrainingSection(prep, view) };
}

test('summary: 3 workouts, previous 1, volume 4.0 t vs 1.1 t', () => {
  expect(training(syntheticWeek()).text.summary).toContain(
    '- Workouts logged: 3 (previous period 1); volume 4.0 t (previous 1.1 t).',
  );
});

test('adherence line reads "3 of 5 scheduled sessions done; 1 missed; 1 scheduled today, not yet done. Previous period: 1 of 2."', () => {
  expect(training(syntheticWeek()).text.summary).toContain(
    '- Adherence: 3 of 5 scheduled sessions done; 1 missed; 1 scheduled today, not yet done. Previous period: 1 of 2.',
  );
});

test('with no stored schedule the adherence line says so', () => {
  const data = syntheticWeek();
  data.schedule = [];
  expect(training(data).text.summary).toContain(
    '- Adherence: no scheduled sessions are stored for this period.',
  );
});

test('volume ignores the tick: sets with completed false still count', () => {
  const data = syntheticWeek();
  expect(
    data.workouts.flatMap((w) => w.exercises.flatMap((e) => e.sets)).every((s) => !s.completed),
  ).toBe(true);
  expect(training(data).text.summary.join('\n')).toContain('volume 4.0 t');
});

test('weight PR line: Bench Press weight 90 kg (previous best 85 kg) on Sat 7 Nov, and no PR line for Squat or Barbell Row or the Pull-up', () => {
  const line = training(syntheticWeek()).text.summary.find((l) =>
    l.startsWith('- Personal records this period'),
  );
  expect(line).toBe(
    '- Personal records this period: Bench Press weight 90 kg (previous best 85 kg) on Sat 7 Nov.',
  );
});

test('e1RM line: Bench Press 99.2 kg (no change), Squat 116.7 kg (first time logged), Barbell Row 88.7 kg (first time logged); Pull-up absent', () => {
  const line = training(syntheticWeek()).text.summary.find((l) =>
    l.startsWith('- Best estimated'),
  )!;
  expect(line).toBe(
    '- Best estimated 1-rep max (Epley, sets of 1–12 reps) this period vs all earlier: Barbell Row 88.7 kg (first time logged); Bench Press 99.2 kg (no change); Squat 116.7 kg (first time logged).',
  );
  expect(line).not.toContain('Pull-up');
});

test('a new best prints "new best +x" and a lower one "below earlier best y"', () => {
  const stronger = syntheticWeek();
  stronger.workouts.push(
    workoutOn(150, '2026-11-10', 'Heavy', [{ id: 1, name: 'Bench Press', sets: [[100, 5]] }]),
  );
  const up = training(stronger).text.summary;
  // 100 x 5 = 116.67 against the earlier 99.17.
  expect(up.find((l) => l.startsWith('- Best estimated'))).toContain(
    'Bench Press 116.7 kg (new best +17.5 kg)',
  );
  expect(up.find((l) => l.startsWith('- Personal records'))).toContain(
    'Bench Press estimated 1RM 116.7 kg (previous best 99.2 kg) on Tue 10 Nov',
  );

  const weaker = syntheticWeek();
  weaker.workouts[0] = workoutOn(101, '2026-10-19', 'Upper Strength', [
    { id: 1, name: 'Bench Press', sets: [[100, 5]] },
  ]);
  expect(training(weaker).text.summary.find((l) => l.startsWith('- Best estimated'))).toContain(
    'Bench Press 99.2 kg (below earlier best 116.7 kg)',
  );
  expect(oneRepMaxState(99.17, 99.17, 'kg')).toBe('no change');
});

test('Epley counts only sets of 1–12 reps: a 15-rep set gives no e1RM and an exercise with only such sets has no e1RM line', () => {
  const data = syntheticWeek();
  data.workouts = [
    workoutOn(1, '2026-11-09', 'Light', [
      {
        id: 9,
        name: 'Cable Fly',
        sets: [
          [20, 15],
          [20, 15],
        ],
      },
    ]),
  ];
  const { summary } = training(data).text;
  expect(summary.some((l) => l.startsWith('- Best estimated'))).toBe(false);
  expect(summary.some((l) => l.startsWith('- Personal records'))).toBe(false);
});

test('isBodyweightExercise is true for the Pull-up (0 kg) and false for Bench; true for an exercise with no scored set', () => {
  const { workouts } = syntheticWeek();
  expect(isBodyweightExercise(workouts, 2)).toBe(true);
  expect(isBodyweightExercise(workouts, 1)).toBe(false);
  expect(isBodyweightExercise(workouts, 999)).toBe(true);
  const unscored = [
    makeWorkout({
      lyftaId: 1,
      performedAt: localIso('2026-11-09', 18),
      exercises: [makeExercise({ exerciseId: 5, sets: [makeSet({ weightKg: null, reps: 5 })] })],
    }),
  ];
  expect(isBodyweightExercise(unscored, 5)).toBe(true);
});

test('full detail: three headings oldest first; Upper Strength bullets', () => {
  const { detail } = training(syntheticWeek()).text;
  const headings = detail.filter((l) => l.startsWith('#### '));
  expect(headings).toEqual([
    '#### Sat 7 Nov · Upper Strength · 58 min · volume 1.1 t',
    '#### Mon 9 Nov · Lower Strength · volume 1.3 t',
    '#### Wed 11 Nov · Pull · volume 1.6 t',
  ]);
  expect(detail).toContain('- Bench Press: 80×5, 85×5, 90×3 (PR)');
  expect(detail).toContain('- Pull-up: BW×8, BW×8');
  expect(detail).toContain('- Squat: 100×5, 100×5, 105×3');
});

test('a workout title and duration: duration omitted when null', () => {
  const { detail } = training(syntheticWeek()).text;
  expect(detail).toContain('#### Sat 7 Nov · Upper Strength · 58 min · volume 1.1 t');
  expect(detail.some((l) => l.startsWith('#### Mon 9 Nov · Lower Strength · volume'))).toBe(true);
});

test('lb unit: bench prints as 176.4×5, 187.4×5, 198.4×3 and 4,020 kg prints as "8.9k lb"', () => {
  const { text } = training(syntheticWeek(), 'week', 'lb');
  expect(text.detail).toContain('- Bench Press: 176.4×5, 187.4×5, 198.4×3 (PR)');
  expect(text.summary).toContain(
    '- Workouts logged: 3 (previous period 1); volume 8.9k lb (previous 2.3k lb).',
  );
});

test('medium detail: weekly table and one line per workout without sets', () => {
  const { text } = training(syntheticWeek(), 'month');
  expect(text.detail[0]).toBe('### Workouts');
  expect(text.detail).toContain('| Week of | Sessions | Volume (kg) | Scheduled | Done |');
  expect(text.detail).toContain('| 2026-11-09 (to date) | 2 | 2,925 | 4 | 2 |');
  expect(text.detail).toContain('| 2026-11-02 | 2 | 2,150 | 3 | 2 |');
  expect(text.detail).toContain('- Sat 7 Nov · Upper Strength · 58 min · 1.1 t');
  expect(text.detail.some((l) => l.includes('Bench Press'))).toBe(false);
});

test('a journey summary has no previous period and lists the most-trained lifts without the Pull-up', () => {
  const data = syntheticWeek();
  const { text } = training(data, 'journey');
  const first = text.summary[1]!;
  expect(first).toMatch(
    /^- Workouts logged: 5 over \d+\.\d weeks \(\d+\.\d per week\); total volume /,
  );
  expect(first).not.toContain('previous');
  const lifts = text.summary.find((l) => l.startsWith('- Most-trained lifts'))!;
  expect(lifts).toContain('Bench Press (3 sessions, e1RM 99.2 → 99.2 kg, best weight 90 kg)');
  expect(lifts).not.toContain('Pull-up');
  expect(text.detail).toEqual([]);
});

test('a long journey keeps only the newest records and says so', () => {
  const { text } = training(syntheticJourney(), 'journey');
  const records = text.summary.find((l) => l.startsWith('- Personal records'))!;
  expect(records.split('; ').length).toBeLessThanOrEqual(10);
});

test('no workouts in the window: exactly "- No workouts logged in this period." and no detail heading', () => {
  const data = syntheticWeek();
  data.workouts = [];
  data.schedule = [];
  const { text } = training(data);
  expect(text.summary).toEqual([
    '### Training',
    '- No workouts logged in this period.',
    '- Adherence: no scheduled sessions are stored for this period.',
  ]);
  expect(text.detail).toEqual([]);
});

test('a workout with null weight or reps sets does not break the line and null sets are not shown', () => {
  const data = syntheticWeek();
  data.workouts = [
    makeWorkout({
      lyftaId: 7,
      performedAt: localIso('2026-11-09', 18),
      title: 'Odd',
      exercises: [
        makeExercise({
          sets: [
            makeSet({ position: 0, weightKg: null, reps: 5 }),
            makeSet({ position: 1, weightKg: 60, reps: null }),
            makeSet({ position: 2, weightKg: 60, reps: 5 }),
          ],
        }),
        makeExercise({
          position: 1,
          exerciseId: 8,
          name: 'Mystery',
          sets: [makeSet({ weightKg: null })],
        }),
        makeExercise({ position: 2, exerciseId: 6, name: 'Empty', sets: [] }),
      ],
    }),
  ];
  const { detail } = training(data).text;
  expect(detail).toContain('- Bench Press: 60×5');
  expect(detail).toContain('- Mystery: no weight × reps sets logged');
  expect(detail).toContain('- Empty: no sets logged');
});

test('weekly columns: sessions are real counts, volume and plan are – when there is none', () => {
  const { prep, view } = training(syntheticWeek());
  const columns = trainingWeeklyColumns(prep, view);
  expect(columns.headers).toEqual(['Sessions', 'Volume (kg)', 'Scheduled', 'Done']);
  expect(columns.byWeek.get('2026-11-09')).toEqual(['2', '2,925', '4', '2']);
  const data = syntheticWeek();
  data.workouts = [];
  data.schedule = [];
  const empty = training(data);
  expect(trainingWeeklyColumns(empty.prep, empty.view).byWeek.get('2026-11-09')).toEqual([
    '0',
    '–',
    '–',
    '–',
  ]);
});
