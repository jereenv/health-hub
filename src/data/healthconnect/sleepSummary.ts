import { localDateKey } from '@/domain/time/localDate';

import type { SleepRecord, SleepStageName } from './HealthConnectGateway';
import type { SleepSessionRow } from './HealthConnectRepository';

const MS_PER_SECOND = 1000;

/**
 * One session's stage totals (Ruling 6). Asleep = asleep + light + deep + rem; awake = awake +
 * out of bed; unknown is ignored. A session without known stages counts its whole length as
 * asleep and has no stage split. Returns null when the session ends before it starts.
 */
export function summariseSleep(record: SleepRecord): SleepSessionRow | null {
  const startMs = new Date(record.startAt).getTime();
  const endMs = new Date(record.endAt).getTime();
  if (!(endMs > startMs)) return null;

  const totals: Record<SleepStageName, number> = {
    awake: 0,
    out_of_bed: 0,
    asleep: 0,
    light: 0,
    deep: 0,
    rem: 0,
    unknown: 0,
  };
  let hasStages = false;
  for (const stage of record.stages) {
    const length = new Date(stage.endAt).getTime() - new Date(stage.startAt).getTime();
    if (stage.stage === 'unknown' || !(length > 0)) continue;
    hasStages = true;
    totals[stage.stage] += length;
  }

  const seconds = (milliseconds: number): number => Math.round(milliseconds / MS_PER_SECOND);
  const base = {
    hcId: record.hcId,
    startAt: record.startAt,
    endAt: record.endAt,
    wakeDate: localDateKey(record.endAt),
    hasStages,
  };
  if (!hasStages) {
    return {
      ...base,
      asleepS: seconds(endMs - startMs),
      awakeS: 0,
      lightS: null,
      deepS: null,
      remS: null,
    };
  }
  return {
    ...base,
    asleepS: seconds(totals.asleep + totals.light + totals.deep + totals.rem),
    awakeS: seconds(totals.awake + totals.out_of_bed),
    lightS: seconds(totals.light),
    deepS: seconds(totals.deep),
    remS: seconds(totals.rem),
  };
}
