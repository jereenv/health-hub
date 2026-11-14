/**
 * Local-only calibration check (Plan 4, Task 35). It runs only when HH_CALIBRATION=1 and the
 * owner's reference file exists, so the normal gate and CI never touch private data. This file
 * holds no values: the reference is read at run time and the report goes to the git-ignored
 * ledger folder. Never paste the report anywhere.
 *
 *   HH_CALIBRATION=1 npx jest src/domain/body/calibration.local.test.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { computeBodyMetrics } from './computeBodyMetrics';
import { fatFreeMassSun, impedanceIsUsable } from './formulas';
import type { BodyMetrics, MetricId } from './types';

const REFERENCE_PATH = path.join(
  os.homedir(),
  'personal',
  'health-hub-captures',
  '2026-11-13',
  'movinglife-reference.json',
);
const REPORT_PATH = path.resolve(
  __dirname,
  '../../../.superpowers/sdd/2026-11-13-plan-4-body-composition/calibration.md',
);

/** Payload offsets of the three u16 values in the scale's final frame (Ruling 3). */
const CANDIDATE_OFFSETS = [5, 7, 9] as const;
/** Spec section 18 item 6: body fat within 4 points, water and muscle within 5. */
const TOLERANCE = { body_fat_pct: 4, water_pct: 5, muscle_pct: 5 } as const;

interface MovingLifeValues {
  weightKg: number;
  bodyFatPct: number;
  bodyWaterPct: number;
  skeletalMusclePct: number;
  leanBodyMassKg: number;
  bmrKcal: number;
  visceralFatIndex: number;
  bodyAge: number;
  bodyScore: number;
}

interface Reference {
  profile: { heightCm: number; ageYears: number; sex: 'male' | 'female' };
  weighIns: {
    id: string;
    values: MovingLifeValues;
    bleFinalFrame: { payloadHex: string };
  }[];
}

interface Row {
  label: string;
  ours: number | null;
  theirs: number;
  tolerance?: number;
}

interface CandidateResult {
  offset: number;
  impedanceOhm: number;
  usable: boolean;
  ffmExceedsWeight: boolean;
  metrics: BodyMetrics;
  rows: Row[];
  bodyFatPass: boolean;
  musclePass: boolean;
  fatMassKg: number | null;
}

function u16At(payloadHex: string, offset: number): number {
  const bytes = Buffer.from(payloadHex, 'hex');
  return bytes.readUInt16BE(offset);
}

function valueOf(metrics: BodyMetrics, id: MetricId): number | null {
  return metrics[id]?.value ?? null;
}

function fmt(value: number | null, decimals = 2): string {
  return value === null ? 'n/a' : value.toFixed(decimals);
}

function signed(ours: number | null, theirs: number): string {
  if (ours === null) return 'n/a';
  const diff = ours - theirs;
  return `${diff >= 0 ? '+' : '-'}${Math.abs(diff).toFixed(2)}`;
}

function evaluate(reference: Reference, index: number, offset: number): CandidateResult {
  const weighIn = reference.weighIns[index] as Reference['weighIns'][number];
  const { values } = weighIn;
  const { profile } = reference;
  const impedanceOhm = u16At(weighIn.bleFinalFrame.payloadHex, offset);
  const metrics = computeBodyMetrics({
    weightKg: values.weightKg,
    impedanceOhm,
    legacyBodyFatPct: null,
    heightCm: profile.heightCm,
    ageYears: profile.ageYears,
    sex: profile.sex,
    bmiCutoffs: 'who',
  });
  const identity = {
    sex: profile.sex,
    heightCm: profile.heightCm,
    weightKg: values.weightKg,
    impedanceOhm,
  };
  const ffm = fatFreeMassSun(identity);
  const bodyFat = valueOf(metrics, 'body_fat_pct');
  const water = valueOf(metrics, 'water_pct');
  const muscle = valueOf(metrics, 'muscle_pct');

  const rows: Row[] = [
    {
      label: 'Body fat %',
      ours: bodyFat,
      theirs: values.bodyFatPct,
      tolerance: TOLERANCE.body_fat_pct,
    },
    {
      label: 'Lean mass kg',
      ours: valueOf(metrics, 'lean_mass_kg'),
      theirs: values.leanBodyMassKg,
    },
    { label: 'Water %', ours: water, theirs: values.bodyWaterPct, tolerance: TOLERANCE.water_pct },
    {
      label: 'Skeletal muscle %',
      ours: muscle,
      theirs: values.skeletalMusclePct,
      tolerance: TOLERANCE.muscle_pct,
    },
    { label: 'BMR kcal', ours: valueOf(metrics, 'bmr_kcal'), theirs: values.bmrKcal },
    {
      label: 'Visceral',
      ours: valueOf(metrics, 'visceral_rating'),
      theirs: values.visceralFatIndex,
    },
    {
      label: 'Metabolic age vs bodyAge',
      ours: valueOf(metrics, 'metabolic_age'),
      theirs: values.bodyAge,
    },
    {
      label: 'Health score vs bodyScore',
      ours: valueOf(metrics, 'health_score'),
      theirs: values.bodyScore,
    },
  ];

  const within = (ours: number | null, theirs: number, tolerance: number) =>
    ours !== null && Math.abs(ours - theirs) <= tolerance;

  return {
    offset,
    impedanceOhm,
    usable: impedanceIsUsable(identity),
    ffmExceedsWeight: ffm > values.weightKg,
    metrics,
    rows,
    bodyFatPass: within(bodyFat, values.bodyFatPct, TOLERANCE.body_fat_pct),
    musclePass: within(muscle, values.skeletalMusclePct, TOLERANCE.muscle_pct),
    fatMassKg: valueOf(metrics, 'fat_mass_kg'),
  };
}

function buildReport(reference: Reference, results: CandidateResult[][]): string {
  const lines: string[] = [
    '# Body calibration (local, private; never commit or paste)',
    '',
    'Engine vs MovingLife for each weigh-in and each candidate impedance offset (u16 big-endian at payload offsets 5, 7, 9). Tolerance: body fat 4 points, water 5, muscle 5.',
    '',
  ];

  reference.weighIns.forEach((weighIn, index) => {
    lines.push(`## ${weighIn.id}`, '');
    for (const result of results[index] as CandidateResult[]) {
      const pass = (ok: boolean) => (ok ? 'PASS' : 'FAIL');
      lines.push(
        `### Offset ${result.offset} (impedance ${result.impedanceOhm} ohm)`,
        '',
        `- impedanceIsUsable: ${result.usable}`,
        `- FFM exceeds body weight: ${result.ffmExceedsWeight}`,
        '',
        '| Metric | Engine | MovingLife | Diff | Tolerance |',
        '|---|---|---|---|---|',
      );
      for (const row of result.rows) {
        const verdict =
          row.tolerance === undefined || row.ours === null
            ? ''
            : `${pass(Math.abs(row.ours - row.theirs) <= row.tolerance)} (±${row.tolerance})`;
        lines.push(
          `| ${row.label} | ${fmt(row.ours)} | ${fmt(row.theirs)} | ${signed(row.ours, row.theirs)} | ${verdict} |`,
        );
      }
      lines.push('');
    }
  });

  const first = reference.weighIns[0] as Reference['weighIns'][number];
  const third = reference.weighIns[2] as Reference['weighIns'][number];
  const theirFat = (w: Reference['weighIns'][number]) =>
    (w.values.weightKg * w.values.bodyFatPct) / 100;
  lines.push(
    '## Weigh-in 1 to weigh-in 3 (the water-bottle one)',
    '',
    `MovingLife: fat mass change ${signed(theirFat(third), theirFat(first))}, lean mass change ${signed(third.values.leanBodyMassKg, first.values.leanBodyMassKg)}`,
    '',
    '| Offset | Our fat mass change | Our lean mass change |',
    '|---|---|---|',
  );
  CANDIDATE_OFFSETS.forEach((offset, candidate) => {
    const a = (results[0] as CandidateResult[])[candidate] as CandidateResult;
    const c = (results[2] as CandidateResult[])[candidate] as CandidateResult;
    const delta = (x: number | null, y: number | null) =>
      x === null || y === null ? 'n/a' : signed(y, x);
    lines.push(
      `| ${offset} | ${delta(a.fatMassKg, c.fatMassKg)} | ${delta(valueOf(a.metrics, 'lean_mass_kg'), valueOf(c.metrics, 'lean_mass_kg'))} |`,
    );
  });

  lines.push('', '## Summary', '');
  CANDIDATE_OFFSETS.forEach((offset, candidate) => {
    const per = results.map((r) => r[candidate] as CandidateResult);
    const winner = per.every(
      (r) => r.usable && !r.ffmExceedsWeight && r.bodyFatPass && r.musclePass,
    );
    lines.push(
      `- Offset ${offset}: usable ${per.filter((r) => r.usable).length}/3, FFM below weight ${per.filter((r) => !r.ffmExceedsWeight).length}/3, body fat in tolerance ${per.filter((r) => r.bodyFatPass).length}/3, muscle in tolerance ${per.filter((r) => r.musclePass).length}/3, all criteria met: ${winner}`,
    );
  });
  lines.push('');
  return lines.join('\n');
}

const enabled = process.env.HH_CALIBRATION === '1' && fs.existsSync(REFERENCE_PATH);
const suite = enabled ? describe : describe.skip;

suite('local calibration against the MovingLife reference', () => {
  let reference: Reference;
  let results: CandidateResult[][];

  beforeAll(() => {
    reference = JSON.parse(fs.readFileSync(REFERENCE_PATH, 'utf8')) as Reference;
    results = reference.weighIns.map((_, index) =>
      CANDIDATE_OFFSETS.map((offset) => evaluate(reference, index, offset)),
    );
  });

  test('the reference has three weigh-ins and a profile', () => {
    expect(reference.weighIns).toHaveLength(3);
    expect(reference.profile.heightCm).toBeGreaterThan(0);
    expect(['male', 'female']).toContain(reference.profile.sex);
    for (const weighIn of reference.weighIns) {
      for (const offset of CANDIDATE_OFFSETS) {
        expect(Number.isInteger(u16At(weighIn.bleFinalFrame.payloadHex, offset))).toBe(true);
      }
    }
  });

  test('every weigh-in has the three candidates and no output value is NaN', () => {
    expect(results).toHaveLength(3);
    for (const perWeighIn of results) {
      expect(perWeighIn.map((r) => r.offset)).toEqual([...CANDIDATE_OFFSETS]);
      for (const result of perWeighIn) {
        for (const metric of Object.values(result.metrics)) {
          expect(Number.isNaN(metric?.value)).toBe(false);
        }
        for (const row of result.rows) expect(Number.isNaN(row.ours ?? 0)).toBe(false);
      }
    }
  });

  test('the report is written to the ledger', () => {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, buildReport(reference, results));
    expect(fs.existsSync(REPORT_PATH)).toBe(true);
  });
});
