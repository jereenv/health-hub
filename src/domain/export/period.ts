import { formatDayMonth, formatFullDate } from '@/domain/format/dates';
import type { DateKey } from '@/domain/time/localDate';
import {
  addDays,
  daysBetween,
  localDateKey,
  parseDateKey,
  weekStartKey,
} from '@/domain/time/localDate';
import type { WeightUnit } from '@/domain/workouts/types';

import type {
  DateWindow,
  DetailLevel,
  ExportData,
  ExportRequest,
  PeriodView,
  PresetId,
} from './types';

const WEEK_DAYS = 7;
const MONTH_DAYS = 30;
const FULL_DETAIL_MAX_DAYS = 14;
const MEDIUM_DETAIL_MAX_DAYS = 62;
/** A journey shorter than this has no first-7 against last-7 comparison: the two would overlap. */
const MIN_JOURNEY_COMPARISON_DAYS = 14;

/** Ruling 3: how much detail a period earns. */
export function detailLevel(preset: PresetId, days: number): DetailLevel {
  switch (preset) {
    case 'week':
    case 'workout':
      return 'full';
    case 'month':
      return 'medium';
    case 'journey':
      return 'long';
    case 'custom':
      if (days <= FULL_DETAIL_MAX_DAYS) return 'full';
      return days <= MEDIUM_DETAIL_MAX_DAYS ? 'medium' : 'long';
  }
}

function endingToday(today: DateKey, days: number): DateWindow {
  return { from: addDays(today, -(days - 1)), to: today };
}

function justBefore(window: DateWindow, days: number): DateWindow {
  return { from: addDays(window.from, -days), to: addDays(window.from, -1) };
}

/** Ruling 2. Null for the single-workout preset, which has no period. */
export function resolvePeriod(i: {
  request: ExportRequest;
  today: DateKey;
  unit: WeightUnit;
  firstDataDate: DateKey | null;
}): PeriodView | null {
  const { request, today, unit, firstDataDate } = i;
  const { preset } = request;
  if (preset === 'workout') return null;

  let window: DateWindow;
  if (preset === 'week') window = endingToday(today, WEEK_DAYS);
  else if (preset === 'month') window = endingToday(today, MONTH_DAYS);
  else if (preset === 'journey') {
    window = {
      from: firstDataDate !== null && firstDataDate < today ? firstDataDate : today,
      to: today,
    };
  } else if (request.custom) {
    const to = request.custom.to > today ? today : request.custom.to;
    window = { from: request.custom.from > to ? to : request.custom.from, to };
  } else {
    window = endingToday(today, WEEK_DAYS);
  }

  const days = daysBetween(window.from, window.to) + 1;
  let previous: DateWindow | null;
  if (preset === 'journey') {
    previous =
      days >= MIN_JOURNEY_COMPARISON_DAYS
        ? { from: window.from, to: addDays(window.from, WEEK_DAYS - 1) }
        : null;
  } else {
    previous = justBefore(window, days);
  }

  return {
    window,
    previous,
    days,
    level: detailLevel(preset, days),
    today,
    unit,
    preset,
    includesToday: window.to === today,
    comparisonLabel: preset === 'journey' ? 'journey start' : 'previous period',
  };
}

/**
 * The window the headline figures describe. A journey is compared as "first 7 days against the
 * last 7 days", so its headline window is the last 7 days; every other period is itself.
 */
export function headlineWindow(view: PeriodView): DateWindow {
  if (view.preset !== 'journey') return view.window;
  const from = addDays(view.window.to, -(WEEK_DAYS - 1));
  return { from: from < view.window.from ? view.window.from : from, to: view.window.to };
}

export function inWindow(date: DateKey, window: DateWindow): boolean {
  return date >= window.from && date <= window.to;
}

/** Every date in the window, ascending. */
export function datesIn(window: DateWindow): DateKey[] {
  const dates: DateKey[] = [];
  for (let date = window.from; date <= window.to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/** The Monday of every week that touches the window, ascending. */
export function weekStartsIn(window: DateWindow): DateKey[] {
  const weeks: DateKey[] = [];
  for (let week = weekStartKey(window.from); week <= window.to; week = addDays(week, 7)) {
    weeks.push(week);
  }
  return weeks;
}

/** The part of a Monday-start week that falls inside the window. */
export function weekWithin(weekStart: DateKey, window: DateWindow): DateWindow {
  const end = addDays(weekStart, 6);
  return {
    from: weekStart < window.from ? window.from : weekStart,
    to: end > window.to ? window.to : end,
  };
}

/** ' (to date)' for the week that holds today while the period includes it, else ''. */
export function weekLabel(weekStart: DateKey, view: PeriodView): string {
  const holdsToday = view.today >= weekStart && view.today <= addDays(weekStart, 6);
  return holdsToday && view.includesToday ? `${weekStart} (to date)` : weekStart;
}

/** '6–12 Nov 2026', '14 Oct–12 Nov 2026', '20 Dec 2025–12 Jan 2026'. */
export function periodDates(window: DateWindow): string {
  const from = parseDateKey(window.from);
  const to = parseDateKey(window.to);
  if (window.from === window.to) return formatFullDate(window.to);
  if (from.year !== to.year) return `${formatFullDate(window.from)}–${formatFullDate(window.to)}`;
  if (from.month !== to.month) return `${formatDayMonth(window.from)}–${formatFullDate(window.to)}`;
  return `${from.day}–${formatFullDate(window.to)}`;
}

const TITLE: Readonly<Record<PresetId, string>> = {
  week: 'Weekly check-in',
  month: 'Month review',
  journey: 'Whole journey',
  workout: 'Single workout',
  custom: 'Custom export',
};

export function periodTitle(preset: PresetId, window: DateWindow): string {
  return `# ${TITLE[preset]} · ${periodDates(window)}`;
}

/** The earliest day any source has data, or null when there is none. */
export function earliestDataDate(data: ExportData): DateKey | null {
  const dates: DateKey[] = [
    ...data.readings.map((reading) => localDateKey(reading.measuredAt)),
    ...data.workouts.map((workout) => localDateKey(workout.performedAt)),
    ...data.activity
      .filter(
        (day) =>
          day.steps !== null ||
          day.distanceM !== null ||
          day.activeKcal !== null ||
          day.totalKcal !== null,
      )
      .map((day) => day.date),
    ...data.sleep.map((session) => session.wakeDate),
    ...data.heartRate.map((day) => day.date),
  ];
  return dates.length === 0 ? null : dates.reduce((a, b) => (b < a ? b : a));
}
