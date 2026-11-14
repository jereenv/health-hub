import { formatShortDate } from '@/domain/format/dates';
import { formatCount } from '@/domain/format/numbers';
import type { DateKey } from '@/domain/time/localDate';

import { completedDays, heartRateByDate } from './dailyData';
import { MISSING, mean } from './markdown';
import { headlineWindow, weekStartsIn, weekWithin } from './period';
import type { Prepared } from './prepare';
import type { DateWindow, PeriodView, SectionText } from './types';

interface Figures {
  days: number;
  lowest: number | null;
  highest: number | null;
  averages: number[];
}

function figures(prep: Prepared, window: DateWindow | null, today: DateKey): Figures {
  const empty: Figures = { days: 0, lowest: null, highest: null, averages: [] };
  if (!window) return empty;
  const byDate = heartRateByDate(prep);
  const days = completedDays(window, today);
  const rows = days.flatMap((date) => {
    const row = byDate.get(date);
    return row ? [row] : [];
  });
  if (rows.length === 0) return { ...empty, days: days.length };
  return {
    days: days.length,
    lowest: Math.min(...rows.map((row) => row.minBpm)),
    highest: Math.max(...rows.map((row) => row.maxBpm)),
    averages: rows.map((row) => row.avgBpm),
  };
}

export function buildHeartRateSection(prep: Prepared, view: PeriodView): SectionText {
  const current = figures(prep, headlineWindow(view), view.today);
  const previous = figures(prep, view.previous, view.today);
  const lines: string[] = ['### Heart rate'];

  if (current.averages.length === 0) {
    lines.push('- Heart rate: no data in this period.');
  } else {
    const n = current.averages.length;
    const skipped = current.days - n;
    const scope = view.preset === 'journey' ? ' in the last 7 days' : '';
    const skippedText = skipped > 0 ? ` (${formatCount(skipped, 'day')} without data skipped)` : '';
    let text = `- Heart rate (daily min / avg / max only; no resting heart rate is available): lowest ${current.lowest} bpm, highest ${current.highest} bpm, mean of daily averages ${Math.round(mean(current.averages) as number)} bpm over ${formatCount(n, 'completed day')} with data${scope}${skippedText}`;
    if (view.previous === null) text += '.';
    else if (previous.averages.length === 0) {
      text += `; no data in ${view.preset === 'journey' ? 'the first 7 days' : 'the previous period'}.`;
    } else {
      text += `; ${view.comparisonLabel} mean of daily averages ${Math.round(mean(previous.averages) as number)} bpm (${formatCount(previous.averages.length, 'day')}; lowest ${previous.lowest}, highest ${previous.highest}).`;
    }
    lines.push(text);
  }

  const context = [
    '- Heart rate: daily minimum, average and maximum only. No resting or asleep heart rate is available.',
  ];
  if (view.includesToday) {
    context.push(
      `- Today (${formatShortDate(view.today)}) is partial: its steps, distance and heart rate are marked * and left out of averages and totals.`,
    );
  }
  return { context, summary: lines, detail: [] };
}

/** Mean of the daily averages for each Monday-start week; complete days with data only. */
export function heartRateWeeklyColumns(
  prep: Prepared,
  view: PeriodView,
): { headers: string[]; byWeek: ReadonlyMap<DateKey, string[]> } {
  const byWeek = new Map<DateKey, string[]>();
  for (const week of weekStartsIn(view.window)) {
    const average = mean(figures(prep, weekWithin(week, view.window), view.today).averages);
    byWeek.set(week, [average === null ? MISSING : String(Math.round(average))]);
  }
  return { headers: ['Heart rate avg'], byWeek };
}
