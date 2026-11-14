import { formatShortDate } from '@/domain/format/dates';
import { formatDuration, formatInteger } from '@/domain/format/numbers';
import type { DateKey } from '@/domain/time/localDate';

import { activityWeeklyColumns } from './activitySection';
import {
  activityByDate,
  distanceNumber,
  distanceUnit,
  heartRateByDate,
  nightsIn,
} from './dailyData';
import { heartRateWeeklyColumns } from './heartRateSection';
import { MISSING, dayLabel, mdTable } from './markdown';
import { datesIn, weekLabel, weekStartsIn } from './period';
import type { Prepared } from './prepare';
import { sleepWeeklyColumns } from './sleepSection';
import type { DateWindow, PeriodView, SectionId } from './types';

export { completedDays } from './dailyData';

/** Which of the three sections share the table. The default is all of them. */
export type DailySections = Readonly<
  Pick<Record<SectionId, boolean>, 'activity' | 'sleep' | 'heartRate'>
>;

const ALL_THREE: DailySections = { activity: true, sleep: true, heartRate: true };

const TODAY_FOOTNOTE = '* today: steps, distance and heart rate so far.';

/**
 * One row per day of `days`, one table for activity, sleep and heart rate. A missing value is
 * "–". Today's steps, distance and heart rate are shown (the row carries a *) although the
 * summary leaves them out.
 */
export function buildDailyActivityTable(
  prep: Prepared,
  view: PeriodView,
  days: DateWindow,
  on: DailySections = ALL_THREE,
): string[] {
  const activity = activityByDate(prep);
  const heartRate = heartRateByDate(prep);
  const nights = new Map(nightsIn(prep, days).map((night) => [night.date, night]));
  const partialColumns = on.activity || on.heartRate;

  const headers = ['Date'];
  if (on.activity) headers.push('Steps', `Distance (${distanceUnit(view.unit)})`);
  if (on.sleep) headers.push('Sleep (night ending that day)');
  if (on.heartRate) headers.push('Heart rate min / avg / max');

  const rows = datesIn(days).map((date) => {
    const row = [partialColumns ? dayLabel(date, view.today) : formatShortDate(date)];
    if (on.activity) {
      const day = activity.get(date);
      row.push(
        day?.steps == null ? MISSING : formatInteger(day.steps),
        day?.distanceM == null ? MISSING : distanceNumber(day.distanceM, view.unit),
      );
    }
    if (on.sleep) {
      const night = nights.get(date);
      row.push(night ? formatDuration(night.asleepS) : MISSING);
    }
    if (on.heartRate) {
      const beats = heartRate.get(date);
      row.push(beats ? `${beats.minBpm} / ${Math.round(beats.avgBpm)} / ${beats.maxBpm}` : MISSING);
    }
    return row;
  });

  const lines = mdTable(headers, rows);
  if (partialColumns && days.to >= view.today) lines.push('', TODAY_FOOTNOTE);
  return lines;
}

/** The weekly table (medium level): one row per Monday-start week touching the window. */
export function buildPeriodTable(
  prep: Prepared,
  view: PeriodView,
  on: DailySections = ALL_THREE,
): string[] {
  const columns: { headers: string[]; byWeek: ReadonlyMap<DateKey, string[]> }[] = [];
  if (on.activity) columns.push(activityWeeklyColumns(prep, view));
  if (on.sleep) columns.push(sleepWeeklyColumns(prep, view));
  if (on.heartRate) columns.push(heartRateWeeklyColumns(prep, view));
  const headers = ['Week of', ...columns.flatMap((column) => column.headers)];
  const rows = weekStartsIn(view.window).map((week) => [
    weekLabel(week, view),
    ...columns.flatMap((column) => column.byWeek.get(week) ?? column.headers.map(() => MISSING)),
  ]);
  return mdTable(headers, rows);
}
