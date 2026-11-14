import type { ActivityDay } from '@/data/healthconnect/HealthConnectRepository';
import { formatShortDate } from '@/domain/format/dates';
import { formatCount, formatInteger } from '@/domain/format/numbers';
import { formatDistance } from '@/domain/format/units';
import type { DateKey } from '@/domain/time/localDate';

import { activityByDate, completedDays, distanceNumber, distanceUnit, sum } from './dailyData';
import { MISSING, formatSignedInteger, mean } from './markdown';
import { headlineWindow, weekStartsIn, weekWithin } from './period';
import type { Prepared } from './prepare';
import type { DateWindow, PeriodView, SectionText } from './types';

type Pick = (day: ActivityDay) => number | null;

interface Figures {
  /** Complete days in the window. */
  days: number;
  values: number[];
}

function figures(
  byDate: ReadonlyMap<DateKey, ActivityDay>,
  window: DateWindow | null,
  today: DateKey,
  pick: Pick,
): Figures {
  if (!window) return { days: 0, values: [] };
  const days = completedDays(window, today);
  const values = days.flatMap((date) => {
    const day = byDate.get(date);
    const value = day ? pick(day) : null;
    return value === null || value === undefined ? [] : [value];
  });
  return { days: days.length, values };
}

interface Format {
  /** A value with its unit, e.g. "8,000" or "7.0 km". */
  value: (n: number) => string;
  /** A signed difference with its unit. */
  change: (n: number) => string;
}

function metricLine(
  label: string,
  current: Figures,
  previous: Figures,
  view: PeriodView,
  format: Format,
  wording: 'steps' | 'distance',
): string {
  if (current.values.length === 0) return `- ${label}: no data in this period.`;
  const average = mean(current.values) as number;
  const n = current.values.length;
  const skipped = current.days - n;
  const scope = view.preset === 'journey' ? ' in the last 7 days' : '';
  let text: string;
  if (wording === 'steps') {
    const skippedText = skipped > 0 ? ` (${formatCount(skipped, 'day')} without data skipped)` : '';
    text = `- ${label}: mean ${format.value(average)} per day over ${formatCount(n, 'completed day')} with data${scope}${skippedText}; total ${format.value(sum(current.values))}`;
  } else {
    text = `- ${label}: mean ${format.value(average)} per day over ${formatCount(n, 'day')} with data${scope} (recorded on ${n} of ${current.days} completed days); total ${format.value(sum(current.values))}`;
  }
  const name = view.comparisonLabel;
  if (view.previous === null) return `${text}.`;
  if (previous.values.length === 0) {
    const none = view.preset === 'journey' ? 'the first 7 days' : 'the previous period';
    return `${text}; no data in ${none}.`;
  }
  const previousMean = mean(previous.values) as number;
  return `${text}; ${name} ${format.value(previousMean)} per day (${formatCount(previous.values.length, 'day')}); change ${format.change(average - previousMean)}.`;
}

function signedDistance(meters: number, view: PeriodView): string {
  const text = formatDistance(Math.abs(meters), view.unit);
  const rounded = text.split(' ')[0] as string;
  if (Number(rounded) === 0) return '0';
  return `${meters > 0 ? '+' : '−'}${text}`;
}

export function buildActivitySection(prep: Prepared, view: PeriodView): SectionText {
  const byDate = activityByDate(prep);
  const headline = headlineWindow(view);
  const at = (window: DateWindow | null, pick: Pick): Figures =>
    figures(byDate, window, view.today, pick);

  const lines: string[] = ['### Activity'];
  const steps: Pick = (day) => day.steps;
  lines.push(
    metricLine(
      'Steps',
      at(headline, steps),
      at(view.previous, steps),
      view,
      { value: formatInteger, change: formatSignedInteger },
      'steps',
    ),
  );
  const distance: Pick = (day) => day.distanceM;
  lines.push(
    metricLine(
      'Distance',
      at(headline, distance),
      at(view.previous, distance),
      view,
      {
        value: (meters) => formatDistance(meters, view.unit),
        change: (meters) => signedDistance(meters, view),
      },
      'distance',
    ),
  );
  const calories: Pick = (day) => day.totalKcal;
  const anyCalories =
    at(headline, calories).values.length > 0 || at(view.previous, calories).values.length > 0;
  if (anyCalories) {
    lines.push(
      metricLine(
        'Total calories (all-day burn, not active calories)',
        at(headline, calories),
        at(view.previous, calories),
        view,
        {
          value: (kcal) => `${formatInteger(kcal)} kcal`,
          change: (kcal) => `${formatSignedInteger(kcal)} kcal`,
        },
        'steps',
      ),
    );
  }

  const context: string[] = [];
  if (view.includesToday) {
    context.push(
      `- Today (${formatShortDate(view.today)}) is partial: its steps, distance and heart rate are marked * and left out of averages and totals.`,
    );
  }
  return { context, summary: lines, detail: [] };
}

/** Steps/day and distance/day for each Monday-start week; complete days with data only. */
export function activityWeeklyColumns(
  prep: Prepared,
  view: PeriodView,
): { headers: string[]; byWeek: ReadonlyMap<DateKey, string[]> } {
  const byDate = activityByDate(prep);
  const byWeek = new Map<DateKey, string[]>();
  for (const week of weekStartsIn(view.window)) {
    const days = weekWithin(week, view.window);
    const stepAverage = mean(figures(byDate, days, view.today, (d) => d.steps).values);
    const distanceAverage = mean(figures(byDate, days, view.today, (d) => d.distanceM).values);
    byWeek.set(week, [
      stepAverage === null ? MISSING : formatInteger(stepAverage),
      distanceAverage === null ? MISSING : distanceNumber(distanceAverage, view.unit),
    ]);
  }
  return {
    headers: ['Steps/day', `Distance/day (${distanceUnit(view.unit)})`],
    byWeek,
  };
}
