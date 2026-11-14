import type { ExportData, ExportRequest, PresetId } from './types';
import type { WeightUnit } from '@/domain/workouts/types';

import {
  SYNTHETIC_PROFILE,
  SYNTHETIC_TODAY,
  syntheticJourney,
  syntheticWeek,
} from './__fixtures__/synthetic';
import { bodyWeeklyColumns, buildBodySection } from './bodySection';
import { earliestDataDate, resolvePeriod } from './period';
import { prepareExportData } from './prepare';

const SECTIONS = { body: true, workouts: true, activity: true, sleep: true, heartRate: true };

function body(data: ExportData, preset: PresetId = 'week', unit: WeightUnit = 'kg') {
  const request: ExportRequest = {
    preset,
    sections: SECTIONS,
    starter: '',
    workoutId: null,
    custom: null,
    includeCsv: false,
  };
  const view = resolvePeriod({
    request,
    today: SYNTHETIC_TODAY,
    unit,
    firstDataDate: earliestDataDate(data),
  })!;
  const prep = prepareExportData(data);
  return { prep, view, text: buildBodySection(prep, view) };
}

function lines(data: ExportData, preset: PresetId = 'week', unit: WeightUnit = 'kg'): string {
  const { text } = body(data, preset, unit);
  return [...text.context, ...text.summary, ...text.detail].join('\n');
}

test('weight line: mean 83.6 of 5 weigh-in days, previous 84.7 (4 days), change −1.1 kg, tier Measured, origin scale', () => {
  expect(body(syntheticWeek()).text.summary).toContain(
    '- Weight (Measured, scale): 83.6 kg mean of 5 weigh-in days; previous period 84.7 kg (4 days); change −1.1 kg.',
  );
});

test('a day with two readings uses the first one only (Nov 8 is 83.8, not 84.6)', () => {
  const text = lines(syntheticWeek());
  expect(text).toContain('| Sun 8 Nov | 83.8 | 23.8 |');
  expect(text).not.toContain('84.6');
});

test("body fat line is labelled Estimated and MovingLife's own figure: 23.6 % mean, previous 24.7 %, change −1.1 pts", () => {
  expect(body(syntheticWeek()).text.summary).toContain(
    "- Body fat (Estimated, MovingLife's own figure): 23.6 % mean of 5 weigh-in days; previous period 24.7 % (4 days); change −1.1 pts.",
  );
});

test('fat mass and lean mass are labelled "derived from MovingLife body fat"', () => {
  const { summary } = body(syntheticWeek()).text;
  expect(summary).toContain(
    '- Fat mass (Estimated, derived from MovingLife body fat): 19.7 kg mean of 5 weigh-in days; previous period 20.9 kg (4 days); change −1.2 kg.',
  );
  expect(summary.find((line) => line.startsWith('- Lean mass'))).toContain(
    '(Estimated, derived from MovingLife body fat): 63.9 kg mean of 5 weigh-in days',
  );
});

test('the latest weigh-in line gives 83.2 kg on Thu 12 Nov and says it is a single reading', () => {
  expect(body(syntheticWeek()).text.summary).toContain(
    '- Latest weigh-in: 83.2 kg on Thu 12 Nov (a single reading, not an average).',
  );
});

test('water, muscle, bone, protein, visceral, metabolic age and health score never appear as metric lines and one line says why', () => {
  const { summary } = body(syntheticWeek()).text;
  for (const label of [
    'Body water',
    'Muscle',
    'Bone mass',
    'Protein',
    'Visceral',
    'Metabolic age',
    'Health score',
  ]) {
    expect(summary.some((line) => line.startsWith(`- ${label}`))).toBe(false);
  }
  const why = summary.filter((line) => line.startsWith('- Not available for MovingLife'));
  expect(why).toHaveLength(1);
  expect(why[0]).toContain(
    'body water, muscle, bone mass, protein, visceral fat, metabolic age, health score',
  );
  expect(why[0]).toContain('impedance');
});

test('a loss-rate line appears and has the form "kg/week (… % of body weight per week, last 28 days"', () => {
  const line = body(syntheticWeek()).text.summary.find((l) => l.startsWith('- Loss rate'));
  expect(line).toMatch(
    /^- Loss rate: \d+\.\d{2} kg\/week \(\d+\.\d{2} % of body weight per week, last 28 days, healthy band 0\.5–1 %\) — (Slow|Healthy|Fast)\.$/,
  );
});

test('the goal line says the latest weight is 8.2 kg above the 75.0 kg goal', () => {
  expect(body(syntheticWeek()).text.summary).toContain(
    '- Goal: 8.2 kg above goal weight (83.2 kg vs 75.0 kg).',
  );
});

test('the goal line says below when under the goal and at when equal', () => {
  const below = syntheticWeek();
  below.versions = [{ ...SYNTHETIC_PROFILE, goalWeightKg: 90 }];
  expect(body(below).text.summary).toContain(
    '- Goal: 6.8 kg below goal weight (83.2 kg vs 90.0 kg).',
  );
  const at = syntheticWeek();
  at.versions = [{ ...SYNTHETIC_PROFILE, goalWeightKg: 83.2 }];
  expect(body(at).text.summary).toContain('- Goal: at goal weight (83.2 kg vs 83.2 kg).');
});

test('watch checks are listed separately and no scale line mentions them', () => {
  const { text } = body(syntheticWeek());
  expect(text.summary).toContain(
    '- Watch body-fat checks (Galaxy Watch, separate from the scale; not blended): 3 checks on 2 days, mean of the checks 26.2 %.',
  );
  const detail = text.detail.join('\n');
  expect(detail).toContain('### Watch body-fat checks (Galaxy Watch; separate from the scale)');
  expect(detail).toContain('| Sun 8 Nov | 26.3 |');
  expect(detail).toContain('| Wed 11 Nov | 26.0 |');
  const scaleLines = text.summary.filter((line) => !line.startsWith('- Watch'));
  expect(scaleLines.some((line) => /26\.[0-9] %/.test(line))).toBe(false);
});

test('the daily table has 7 rows for Nov 6–12, Nov 7 and Nov 11 show – in every value column, and no cell is 0', () => {
  const { detail } = body(syntheticWeek()).text;
  const start = detail.findIndex((line) => line.startsWith('| Date | Weight (kg)'));
  expect(detail[start]).toBe(
    '| Date | Weight (kg) | Body fat (%) | Fat mass (kg) | Lean mass (kg) | Body-fat source |',
  );
  const rows = detail.slice(start + 2, start + 9);
  expect(rows.map((row) => row.split('|')[1]!.trim())).toEqual([
    'Fri 6 Nov',
    'Sat 7 Nov',
    'Sun 8 Nov',
    'Mon 9 Nov',
    'Tue 10 Nov',
    'Wed 11 Nov',
    'Thu 12 Nov*',
  ]);
  expect(rows[1]).toBe('| Sat 7 Nov | – | – | – | – | – |');
  expect(rows[5]).toBe('| Wed 11 Nov | – | – | – | – | – |');
  expect(rows[0]).toBe('| Fri 6 Nov | 84.0 | 24.0 | 20.2 | 63.8 | MovingLife |');
  for (const row of rows) {
    expect(
      row
        .split('|')
        .slice(2, -1)
        .map((cell) => cell.trim()),
    ).not.toContain('0');
  }
});

test('Nov 12 is labelled with a trailing * (today)', () => {
  expect(lines(syntheticWeek())).toContain('| Thu 12 Nov* | 83.2 |');
});

test('lb unit: the weight line reads "184.3 lb mean … previous period 186.7 lb … change −2.4 lb" and the table header says (lb)', () => {
  const text = lines(syntheticWeek(), 'week', 'lb');
  expect(text).toContain(
    '- Weight (Measured, scale): 184.3 lb mean of 5 weigh-in days; previous period 186.7 lb (4 days); change −2.4 lb.',
  );
  expect(text).toContain('| Date | Weight (lb) | Body fat (%) | Fat mass (lb) | Lean mass (lb) |');
  expect(text).toContain('- Goal: 18.1 lb above goal weight (183.4 lb vs 165.3 lb).');
});

test('a period with no weigh-ins prints exactly "- No weigh-ins in this period." and no table', () => {
  const data = syntheticWeek();
  data.readings = [];
  data.watch = [];
  const { text } = body(data);
  expect(text.summary).toEqual(['### Body', '- No weigh-ins in this period.']);
  expect(text.detail).toEqual([]);
  expect(text.context).toEqual([]);
});

test('the previous period with a different method prints "previous period used a different method; not compared"', () => {
  const data = syntheticWeek();
  // Scale readings with impedance before Nov 6: body fat there is the Health Hub formula's.
  data.readings = data.readings.map((reading) =>
    reading.measuredAt < new Date(2026, 10, 6).toISOString()
      ? { ...reading, impedanceOhm: 500, legacyBodyFatPct: null }
      : reading,
  );
  const { summary } = body(data).text;
  expect(summary).toContain(
    "- Body fat (Estimated, MovingLife's own figure): 23.6 % mean of 5 weigh-in days; previous period used a different method; not compared.",
  );
  expect(summary.find((line) => line.startsWith('- Weight'))).toContain('change −1.1 kg');
});

test('formula-origin readings are labelled "Health Hub formula v1" and add water and muscle columns', () => {
  const data = syntheticWeek();
  data.readings = data.readings.map((reading) => ({
    ...reading,
    impedanceOhm: 500,
    legacyBodyFatPct: null,
  }));
  const { text } = body(data);
  const bodyFat = text.summary.find((line) => line.startsWith('- Body fat'))!;
  expect(bodyFat).toContain('(Estimated, Health Hub formula v1)');
  expect(text.detail.join('\n')).toContain('Body water (%) | Muscle (%) | Body-fat source |');
  expect(text.detail.join('\n')).toContain('| Health Hub formula |');
  expect(text.context.find((line) => line.startsWith('- Body-composition formulas'))).toMatch(
    /^- Body-composition formulas: Health Hub version 1 \(Sun et al\., 2003; Janssen et al\., 2000; /,
  );
  expect(text.summary.some((line) => line.startsWith('- Not available for MovingLife'))).toBe(
    false,
  );
});

test('journey view compares the first 7 days with now and says "journey start"', () => {
  const { text } = body(syntheticJourney(), 'journey');
  const weight = text.summary.find((line) => line.startsWith('- Weight'))!;
  expect(weight).toContain('in the last 7 days; journey start ');
  expect(weight).toMatch(/\(\d+ days\); change −\d+\.\d kg\.$/);
  expect(weight).not.toContain('previous period');
});

test('the formula version line names version 1 in both the formula and the all-MovingLife cases', () => {
  const legacy = body(syntheticWeek()).text.context.join('\n');
  expect(legacy).toContain(
    "- Body-composition formulas: Health Hub version 1; no body-composition value in this briefing was computed by them (all body fat is MovingLife's own).",
  );
  expect(legacy).toContain('MovingLife: its body fat is that app');
});

test('missing profile (no height, sex, birth date): weight still prints, BMI and ranges-dependent lines are absent, nothing throws', () => {
  const data = syntheticWeek();
  data.versions = [];
  const { text } = body(data);
  expect(text.summary.some((line) => line.startsWith('- Weight'))).toBe(true);
  expect(text.summary.some((line) => line.startsWith('- BMI'))).toBe(false);
  expect(text.summary.some((line) => line.startsWith('- Goal'))).toBe(false);
});

test('weekly columns: the week of 2026-11-09 has 3 weigh-in days (Nov 9, 10, 12), weight mean 83.4 and body fat mean 23.4', () => {
  const { prep, view } = body(syntheticWeek());
  const columns = bodyWeeklyColumns(prep, view);
  expect(columns.headers).toEqual(['Weigh-in days', 'Weight (kg)', 'Body fat (%)']);
  expect(columns.byWeek.get('2026-11-09')).toEqual(['3', '83.4', '23.4']);
  // Nov 6 and Nov 8 are the part of the week of Nov 2 inside the window.
  expect(columns.byWeek.get('2026-11-02')).toEqual(['2', '83.9', '23.9']);
});

test('a week with no weigh-ins shows – in every cell', () => {
  const data = syntheticWeek();
  data.readings = data.readings.filter((reading) => reading.id < 8 || reading.id > 10);
  const { prep, view } = body(data);
  expect(bodyWeeklyColumns(prep, view).byWeek.get('2026-11-02')).toEqual(['–', '–', '–']);
});

test('journey detail is the last 14 days only', () => {
  const { text } = body(syntheticJourney(), 'journey');
  expect(text.detail[0]).toBe("### Body — last 14 days (each day's first weigh-in)");
  const rows = text.detail.slice(3);
  expect(rows).toHaveLength(14);
  expect(rows[0]).toContain('Fri 30 Oct');
  expect(rows[13]).toContain('Thu 12 Nov*');
});
