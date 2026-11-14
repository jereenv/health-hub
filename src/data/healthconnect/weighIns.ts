import { isSameTime, isSameWeighIn, type MatchRule } from '@/data/body/weighInMatch';

import { MOVINGLIFE_ORIGIN, SAMSUNG_HEALTH_ORIGIN, WEIGH_IN_MATCH } from './constants';
import type { BodyRecord } from './HealthConnectGateway';
import type { WatchBodyFat, WeighIn } from './HealthConnectRepository';

export interface WeighInResult {
  weighIns: WeighIn[];
  watchBodyFat: WatchBodyFat[];
  /** Records from origins we do not import. */
  ignored: number;
  /** MovingLife body fat that matched no weigh-in. */
  orphanBodyFat: number;
  /** Records with values no person could have. */
  implausible: number;
}

const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 400;

function byTimeThenId(a: BodyRecord, b: BodyRecord): number {
  return a.time < b.time
    ? -1
    : a.time > b.time
      ? 1
      : a.hcId < b.hcId
        ? -1
        : a.hcId > b.hcId
          ? 1
          : 0;
}

function ms(record: { time: string }): number {
  return new Date(record.time).getTime();
}

function sameTime(a: BodyRecord, b: BodyRecord, rule: MatchRule): boolean {
  return isSameTime(a.time, b.time, rule);
}

function sameWeighIn(first: BodyRecord, candidate: BodyRecord, rule: MatchRule): boolean {
  return isSameWeighIn(
    { time: first.time, weightKg: first.value },
    { time: candidate.time, weightKg: candidate.value },
    rule,
  );
}

function plausibleBodyFat(value: number): boolean {
  return value > 0 && value < 100;
}

/**
 * Turns Health Connect weight and body-fat records into scale weigh-ins and watch body fat.
 * MovingLife records become weigh-ins (near-identical readings collapse into one); Samsung body
 * fat becomes watch body fat; everything else is ignored. Deterministic for unsorted input.
 */
export function buildWeighIns(
  weights: readonly BodyRecord[],
  bodyFat: readonly BodyRecord[],
  rule: MatchRule = WEIGH_IN_MATCH,
): WeighInResult {
  let ignored = 0;
  let implausible = 0;
  let orphanBodyFat = 0;

  const candidates: BodyRecord[] = [];
  for (const weight of weights) {
    if (weight.origin !== MOVINGLIFE_ORIGIN) {
      ignored += 1;
    } else if (weight.value < MIN_WEIGHT_KG || weight.value > MAX_WEIGHT_KG) {
      implausible += 1;
    } else {
      candidates.push(weight);
    }
  }
  candidates.sort(byTimeThenId);

  const groups: BodyRecord[][] = [];
  for (const record of candidates) {
    const current = groups[groups.length - 1];
    if (current !== undefined && sameWeighIn(current[0]!, record, rule)) current.push(record);
    else groups.push([record]);
  }

  const attached: (BodyRecord | null)[] = groups.map(() => null);
  const watchBodyFat: WatchBodyFat[] = [];
  for (const fat of [...bodyFat].sort(byTimeThenId)) {
    if (fat.origin !== MOVINGLIFE_ORIGIN && fat.origin !== SAMSUNG_HEALTH_ORIGIN) {
      ignored += 1;
    } else if (!plausibleBodyFat(fat.value)) {
      implausible += 1;
    } else if (fat.origin === SAMSUNG_HEALTH_ORIGIN) {
      watchBodyFat.push({
        hcId: fat.hcId,
        measuredAt: fat.time,
        bodyFatPct: fat.value,
        origin: fat.origin,
      });
    } else {
      // Nearest weigh-in that passes the rule's time test; earlier weigh-in wins a tie.
      let best = -1;
      let bestGap = Infinity;
      groups.forEach((group, index) => {
        const first = group[0]!;
        if (!sameTime(first, fat, rule)) return;
        const gap = Math.abs(ms(first) - ms(fat));
        if (gap < bestGap) {
          best = index;
          bestGap = gap;
        }
      });
      if (best === -1) orphanBodyFat += 1;
      else if (attached[best] === null) attached[best] = fat; // sorted, so the earliest wins
    }
  }

  const weighIns = groups.map((group, index): WeighIn => {
    const first = group[0]!;
    const fat = attached[index] ?? null;
    return {
      measuredAt: first.time,
      weightKg: first.value,
      sourceRecordId: first.hcId,
      rawPayload: JSON.stringify({
        weightRecordIds: group.map((r) => r.hcId),
        bodyFatRecordId: fat?.hcId ?? null,
      }),
      bodyFatPct: fat?.value ?? null,
    };
  });

  return { weighIns, watchBodyFat, ignored, orphanBodyFat, implausible };
}
