import type { WeightUnit } from '@/domain/workouts/types';

import { earliestDataDate, resolvePeriod } from '../period';
import { prepareExportData } from '../prepare';
import type { ExportData, ExportRequest, PeriodView, PresetId } from '../types';

import { SYNTHETIC_TODAY } from './synthetic';

export const ALL_SECTIONS = {
  body: true,
  workouts: true,
  activity: true,
  sleep: true,
  heartRate: true,
} as const;

export function requestFor(preset: PresetId, extra: Partial<ExportRequest> = {}): ExportRequest {
  return {
    preset,
    sections: ALL_SECTIONS,
    starter: '',
    workoutId: null,
    custom: null,
    includeCsv: false,
    ...extra,
  };
}

/** The prepared data and period view for a preset on the synthetic "today". */
export function setup(
  data: ExportData,
  preset: PresetId = 'week',
  unit: WeightUnit = 'kg',
  extra: Partial<ExportRequest> = {},
): { prep: ReturnType<typeof prepareExportData>; view: PeriodView } {
  const view = resolvePeriod({
    request: requestFor(preset, extra),
    today: SYNTHETIC_TODAY,
    unit,
    firstDataDate: earliestDataDate(data),
  });
  if (view === null) throw new Error('This preset has no period.');
  return { prep: prepareExportData(data), view };
}
