import { formatDayMonth, formatFullDate, formatMonthYear } from '@/domain/format/dates';
import { DEFAULT_STARTER } from '@/domain/export/starterPrompts';
import type { DateWindow, ExportRequest, PresetId, SectionId } from '@/domain/export/types';
import { SECTION_IDS } from '@/domain/export/types';
import type { DateKey } from '@/domain/time/localDate';
import { addDays, localDateKey, parseDateKey } from '@/domain/time/localDate';

const SEEDED_RANGE_DAYS = 14;

export interface ExportForm {
  preset: PresetId;
  sections: Record<SectionId, boolean>;
  starter: string;
  /** True once the owner has typed in the starter box; a preset switch then keeps the text. */
  starterEdited: boolean;
  workoutId: number | null;
  custom: DateWindow | null;
  includeCsv: boolean;
}

export type FormAction =
  | { type: 'preset'; preset: PresetId; today: DateKey; firstDataDate: DateKey | null }
  | { type: 'toggleSection'; section: SectionId }
  | { type: 'toggleCsv' }
  | { type: 'starter'; text: string }
  | { type: 'workout'; id: number }
  | { type: 'customRange'; window: DateWindow };

export function initialForm(latestWorkoutId: number | null): ExportForm {
  return {
    preset: 'week',
    sections: { body: true, workouts: true, activity: true, sleep: true, heartRate: true },
    starter: DEFAULT_STARTER.week,
    starterEdited: false,
    workoutId: latestWorkoutId,
    custom: null,
    includeCsv: true,
  };
}

/** The last 14 days, never starting before the first day with data. */
function seededRange(today: DateKey, firstDataDate: DateKey | null): DateWindow {
  const from = addDays(today, -(SEEDED_RANGE_DAYS - 1));
  return {
    from:
      firstDataDate !== null && firstDataDate > from && firstDataDate <= today
        ? firstDataDate
        : from,
    to: today,
  };
}

export function formReducer(form: ExportForm, action: FormAction): ExportForm {
  switch (action.type) {
    case 'preset':
      return {
        ...form,
        preset: action.preset,
        starter: form.starterEdited ? form.starter : DEFAULT_STARTER[action.preset],
        custom:
          action.preset === 'custom' && form.custom === null
            ? seededRange(action.today, action.firstDataDate)
            : form.custom,
      };
    case 'toggleSection':
      return {
        ...form,
        sections: { ...form.sections, [action.section]: !form.sections[action.section] },
      };
    case 'toggleCsv':
      return { ...form, includeCsv: !form.includeCsv };
    case 'starter':
      return { ...form, starter: action.text, starterEdited: true };
    case 'workout':
      return { ...form, workoutId: action.id };
    case 'customRange':
      return { ...form, custom: action.window };
  }
}

/** Ruling 13: the chips a preset offers. */
export function visibleChips(preset: PresetId): (SectionId | 'csv')[] {
  if (preset === 'workout') return ['body', 'sleep'];
  return preset === 'journey' ? [...SECTION_IDS, 'csv'] : [...SECTION_IDS];
}

/**
 * Share and Copy need a briefing to send: at least one visible section on (the CSV chip alone
 * leaves the text empty), and a chosen workout for a single workout (which is always included, so no chip is needed).
 */
export function canShare(form: ExportForm): boolean {
  if (form.preset === 'workout') return form.workoutId !== null;
  return visibleChips(form.preset).some((chip) => chip !== 'csv' && form.sections[chip]);
}

export function toRequest(form: ExportForm): ExportRequest {
  return {
    preset: form.preset,
    sections: form.sections,
    starter: form.starter,
    workoutId: form.workoutId,
    custom: form.custom,
    includeCsv: form.includeCsv && form.preset === 'journey',
  };
}

/** Ruling 15: keeps From and To inside the data and in order; the edge just picked wins. */
export function applyPickedDate(
  window: DateWindow,
  edge: 'from' | 'to',
  picked: DateKey,
  bounds: { first: DateKey; today: DateKey },
): DateWindow {
  const floor = bounds.first > bounds.today ? bounds.today : bounds.first;
  const day = picked > bounds.today ? bounds.today : picked < floor ? floor : picked;
  if (edge === 'from') return { from: day, to: window.to < day ? day : window.to };
  return { from: window.from > day ? day : window.from, to: day };
}

/** The Android picker hands back a Date; its local calendar day is the one the owner chose. */
export function localDateKeyFromPicker(date: Date): DateKey {
  return localDateKey(date);
}

/** A Date for the picker's `value`: local noon, so no zone shift moves the day. */
export function pickerDateFromKey(key: DateKey): Date {
  const { year, month, day } = parseDateKey(key);
  return new Date(year, month - 1, day, 12);
}

function rangeText(window: DateWindow, today: DateKey): string {
  const sameYear =
    parseDateKey(window.from).year === parseDateKey(today).year &&
    parseDateKey(window.to).year === parseDateKey(today).year;
  return sameYear
    ? `${formatDayMonth(window.from)} – ${formatDayMonth(window.to)}`
    : `${formatFullDate(window.from)} – ${formatFullDate(window.to)}`;
}

export function presetSubtitle(
  preset: PresetId,
  i: {
    workoutLabel: string | null;
    firstDataDate: DateKey | null;
    today: DateKey;
    custom: DateWindow | null;
  },
): string {
  switch (preset) {
    case 'week':
      return 'Last 7 days vs the week before';
    case 'month':
      return 'Last 30 days';
    case 'journey':
      return i.firstDataDate === null
        ? 'Weekly averages, plus a CSV'
        : `Weekly averages since ${formatMonthYear(i.firstDataDate)}, plus a CSV`;
    case 'workout':
      return i.workoutLabel ?? "Every set, plus that day's body and sleep";
    case 'custom':
      return i.custom === null ? 'Pick dates and sections' : rangeText(i.custom, i.today);
  }
}
