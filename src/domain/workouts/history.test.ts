import { makeExercise, makeSet, makeWorkout } from '@/test-support/workoutBuilders';
import { buildHeatStrip, groupByWeek, HEAT_WEEKS, summarizeHeatStrip } from './history';

/** A workout whose only set lifts `weightKg` for one rep, so its volume is `weightKg`. */
function lift(lyftaId: number, performedAt: string, weightKg: number, durationS: number | null) {
  return makeWorkout({
    lyftaId,
    performedAt,
    durationS,
    exercises: [makeExercise({ sets: [makeSet({ weightKg, reps: 1 })] })],
  });
}

describe('groupByWeek', () => {
  test('a Sunday 23:30 workout stays in its week across the DST change', () => {
    const groups = groupByWeek([
      makeWorkout({ lyftaId: 1, performedAt: '2026-11-02T04:30:00.000Z' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.weekStart).toBe('2026-10-26');
  });

  test('groupByWeek totals sessions, volume and known durations; null when no duration is known', () => {
    const groups = groupByWeek([
      lift(1, '2026-11-10T15:00:00.000Z', 100, 3000),
      lift(2, '2026-11-12T15:00:00.000Z', 50, null),
      lift(3, '2026-11-12T16:00:00.000Z', 20, 600),
      lift(4, '2026-11-03T15:00:00.000Z', 10, null),
    ]);
    expect(groups.map((g) => g.weekStart)).toEqual(['2026-11-09', '2026-11-02']);
    expect(groups[0]).toMatchObject({ sessions: 3, volumeKg: 170, durationS: 3600 });
    expect(groups[0]?.workouts.map((w) => w.lyftaId)).toEqual([3, 2, 1]);
    expect(groups[1]).toMatchObject({ sessions: 1, volumeKg: 10, durationS: null });
  });

  test('newest first breaks performedAt ties by lyftaId descending', () => {
    const groups = groupByWeek([
      lift(5, '2026-11-12T15:00:00.000Z', 1, null),
      lift(9, '2026-11-12T15:00:00.000Z', 1, null),
    ]);
    expect(groups[0]?.workouts.map((w) => w.lyftaId)).toEqual([9, 5]);
  });

  test('no workouts gives no groups', () => {
    expect(groupByWeek([])).toEqual([]);
  });
});

describe('buildHeatStrip', () => {
  test('heat strip is 12 Monday-first columns ending this week, with future days marked', () => {
    const columns = buildHeatStrip([], '2026-11-12');
    expect(HEAT_WEEKS).toBe(12);
    expect(columns).toHaveLength(12);
    expect(columns.every((column) => column.length === 7)).toBe(true);
    expect(columns[0]?.[0]?.date).toBe('2026-08-24');
    const last = columns[11] ?? [];
    expect(last.map((cell) => cell.future)).toEqual([false, false, false, false, true, true, true]);
    expect(last[0]?.date).toBe('2026-11-09');
    expect(last[6]?.date).toBe('2026-11-15');
  });

  test('heat levels scale with day volume and give bodyweight-only days level 1', () => {
    const bodyweight = makeWorkout({
      lyftaId: 4,
      performedAt: '2026-11-11T15:00:00.000Z',
      exercises: [makeExercise({ sets: [makeSet({ weightKg: null, reps: 10 })] })],
    });
    const columns = buildHeatStrip(
      [
        lift(1, '2026-11-09T15:00:00.000Z', 100, null),
        lift(2, '2026-11-10T15:00:00.000Z', 30, null),
        lift(3, '2026-11-10T18:00:00.000Z', 20, null),
        bodyweight,
      ],
      '2026-11-12',
    );
    const [mon, tue, wed, thu] = columns[11] ?? [];
    expect(mon).toMatchObject({ volumeKg: 100, sessions: 1, level: 4 });
    expect(tue).toMatchObject({ volumeKg: 50, sessions: 2, level: 2 });
    expect(wed).toMatchObject({ volumeKg: 0, sessions: 1, level: 1 });
    expect(thu).toMatchObject({ volumeKg: 0, sessions: 0, level: 0 });
  });

  test('a strip with only bodyweight sessions gives them level 1', () => {
    const bodyweight = makeWorkout({
      lyftaId: 1,
      performedAt: '2026-11-09T15:00:00.000Z',
      exercises: [makeExercise({ sets: [makeSet({ weightKg: null, reps: 10 })] })],
    });
    expect(buildHeatStrip([bodyweight], '2026-11-12')[11]?.[0]?.level).toBe(1);
  });

  test('future workouts are marked future, level 0 and ignored for the maximum', () => {
    const columns = buildHeatStrip(
      [
        lift(1, '2026-11-13T15:00:00.000Z', 1000, null),
        lift(2, '2026-11-09T15:00:00.000Z', 10, null),
      ],
      '2026-11-12',
    );
    const last = columns[11] ?? [];
    expect(last[4]).toMatchObject({ date: '2026-11-13', future: true, level: 0 });
    expect(last[0]).toMatchObject({ level: 4 });
  });

  test('workouts before the strip are ignored', () => {
    const columns = buildHeatStrip([lift(1, '2026-01-05T15:00:00.000Z', 100, null)], '2026-11-12');
    expect(columns.flat().every((cell) => cell.sessions === 0)).toBe(true);
  });

  test('a custom week count is honoured', () => {
    expect(buildHeatStrip([], '2026-11-12', 4)).toHaveLength(4);
  });
});

describe('summarizeHeatStrip', () => {
  test('summarizeHeatStrip counts training days among past days', () => {
    const columns = buildHeatStrip(
      [
        lift(1, '2026-11-09T15:00:00.000Z', 10, null),
        lift(2, '2026-11-09T18:00:00.000Z', 10, null),
        lift(3, '2026-11-12T15:00:00.000Z', 10, null),
        lift(4, '2026-11-14T15:00:00.000Z', 10, null),
      ],
      '2026-11-12',
    );
    expect(summarizeHeatStrip(columns)).toEqual({ trainingDays: 2, pastDays: 11 * 7 + 4 });
  });
});
