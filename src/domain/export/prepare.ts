import { computeReadings } from '@/domain/body/readings';
import type { ReadingMetrics } from '@/domain/body/readings';
import type { Profile } from '@/domain/profile/profile';

import type { ExportData } from './types';

export interface Prepared {
  readings: ReadingMetrics[];
  versions: Profile[];
  /** The latest profile version, the one the person line and the goal come from. */
  profile: Profile | null;
  data: ExportData;
}

/** Computed once per export: every reading's metrics, with the profile in effect at its time. */
export function prepareExportData(data: ExportData): Prepared {
  const versions = [...data.versions].sort((a, b) =>
    a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0,
  );
  const readings = [...data.readings].sort((a, b) =>
    a.measuredAt === b.measuredAt ? a.id - b.id : a.measuredAt < b.measuredAt ? -1 : 1,
  );
  return {
    readings: computeReadings(readings, versions),
    versions,
    profile: versions[versions.length - 1] ?? null,
    data,
  };
}
