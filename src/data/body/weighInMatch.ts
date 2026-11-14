import {
  WEIGH_IN_MATCH,
  WEIGH_IN_WEIGHT_TOLERANCE_KG,
  WEIGH_IN_WINDOW_MS,
} from '@/data/healthconnect/constants';
import { localDateKey } from '@/domain/time/localDate';

export type MatchRule = 'time_window' | 'same_day';

export interface WeighInPoint {
  /** ISO-8601 UTC. */
  time: string;
  weightKg: number;
}

const WEIGHT_EPSILON = 1e-9;

/** True when two instants count as the same weigh-in time under `rule`. */
export function isSameTime(aIso: string, bIso: string, rule: MatchRule): boolean {
  return rule === 'time_window'
    ? Math.abs(new Date(aIso).getTime() - new Date(bIso).getTime()) <= WEIGH_IN_WINDOW_MS
    : localDateKey(aIso) === localDateKey(bIso);
}

/** True when two readings are one weigh-in seen twice (same time by `rule`, weights within tolerance). */
export function isSameWeighIn(
  a: WeighInPoint,
  b: WeighInPoint,
  rule: MatchRule = WEIGH_IN_MATCH,
): boolean {
  return (
    isSameTime(a.time, b.time, rule) &&
    Math.abs(a.weightKg - b.weightKg) <= WEIGH_IN_WEIGHT_TOLERANCE_KG + WEIGHT_EPSILON
  );
}
