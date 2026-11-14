import type { DateKey } from '@/domain/time/localDate';
import { addDays, daysBetween } from '@/domain/time/localDate';

import type { DayPoint } from './series';
import { isLegacyOrigin } from './types';

export interface FatVsLean {
  from: DateKey;
  to: DateKey;
  fatChangeKg: number;
  leanChangeKg: number;
  weightChangeKg: number;
  /** Share of the weight lost that was fat, 0 to 1; null unless weight fell by at least 0.5 kg. */
  fatShareOfLoss: number | null;
  /** The comparison uses MovingLife-origin values. */
  hollow: boolean;
}

const WINDOW_DAYS = 30;
const MIN_SPAN_DAYS = 7;
const MIN_LOSS_KG = 0.5;

/**
 * How the change in fat mass compares with the change in lean mass over the last 30 days, using
 * the dates both series share and only the latest method's points. Null with fewer than two
 * shared dates or under 7 days between the first and last.
 */
export function fatVsLean(
  fat: readonly DayPoint[],
  lean: readonly DayPoint[],
  today: DateKey,
): FatVsLean | null {
  const from = addDays(today, -(WINDOW_DAYS - 1));
  const leanByDate = new Map(lean.map((point) => [point.date, point]));
  const shared = fat
    .filter((point) => point.date >= from && point.date <= today)
    .flatMap((fatPoint) => {
      const leanPoint = leanByDate.get(fatPoint.date);
      return leanPoint ? [{ fat: fatPoint, lean: leanPoint }] : [];
    });
  const latest = shared[shared.length - 1];
  if (!latest) return null;

  const hollow = isLegacyOrigin(latest.fat.origin);
  const sameMethod = shared.filter(
    (pair) =>
      isLegacyOrigin(pair.fat.origin) === hollow && isLegacyOrigin(pair.lean.origin) === hollow,
  );
  const first = sameMethod[0];
  const last = sameMethod[sameMethod.length - 1];
  if (!first || !last || sameMethod.length < 2) return null;
  if (daysBetween(first.fat.date, last.fat.date) < MIN_SPAN_DAYS) return null;

  const fatChangeKg = last.fat.value - first.fat.value;
  const leanChangeKg = last.lean.value - first.lean.value;
  const weightChangeKg = fatChangeKg + leanChangeKg;
  const fatShareOfLoss =
    weightChangeKg <= -MIN_LOSS_KG
      ? Math.min(1, Math.max(0, -fatChangeKg / -weightChangeKg))
      : null;
  return {
    from: first.fat.date,
    to: last.fat.date,
    fatChangeKg,
    leanChangeKg,
    weightChangeKg,
    fatShareOfLoss,
    hollow,
  };
}
