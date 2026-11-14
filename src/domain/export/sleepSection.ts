import { formatClock, sleepConsistency } from '@/domain/activity/sleepNights';
import { formatCount, formatDuration } from '@/domain/format/numbers';
import type { DateKey } from '@/domain/time/localDate';
import { daysBetween } from '@/domain/time/localDate';

import { nightsIn } from './dailyData';
import { MISSING, mean } from './markdown';
import { headlineWindow, weekStartsIn, weekWithin } from './period';
import type { Prepared } from './prepare';
import type { PeriodView, SectionText } from './types';

function signedDuration(seconds: number): string {
  const text = formatDuration(Math.abs(seconds));
  if (text === '0 min') return text;
  return `${seconds > 0 ? '+' : '−'}${text}`;
}

export function buildSleepSection(prep: Prepared, view: PeriodView): SectionText {
  const headline = headlineWindow(view);
  const nights = nightsIn(prep, headline);
  const previous = nightsIn(prep, view.previous);
  const lines: string[] = ['### Sleep'];

  if (nights.length === 0) {
    lines.push('- Sleep: no data in this period.');
  } else {
    const average = mean(nights.map((night) => night.asleepS)) as number;
    const dayCount = daysBetween(headline.from, headline.to) + 1;
    const skipped = dayCount - nights.length;
    const scope = view.preset === 'journey' ? ' in the last 7 days' : '';
    const skippedText = skipped > 0 ? ` (${formatCount(skipped, 'day')} without data skipped)` : '';
    let text = `- Sleep: mean ${formatDuration(average)} per night over ${formatCount(nights.length, 'night')} with data${scope}${skippedText}`;
    if (view.previous === null) text += '.';
    else if (previous.length === 0) {
      text += `; no data in ${view.preset === 'journey' ? 'the first 7 days' : 'the previous period'}.`;
    } else {
      const previousMean = mean(previous.map((night) => night.asleepS)) as number;
      text += `; ${view.comparisonLabel} ${formatDuration(previousMean)} (${formatCount(previous.length, 'night')}); change ${signedDuration(average - previousMean)}.`;
    }
    lines.push(text);

    const consistency = sleepConsistency(nights);
    if (consistency) {
      lines.push(
        `- Typical bedtime ${formatClock(consistency.averageBedtimeMin)}, wake ${formatClock(consistency.averageWakeMin)}, bedtime spread ±${consistency.bedtimeSpreadMin} min.`,
      );
    }
    const staged = nights.filter(
      (night) => night.lightS !== null && night.deepS !== null && night.remS !== null,
    );
    if (staged.length > 0) {
      const stage = (pick: (n: (typeof staged)[number]) => number | null): string =>
        formatDuration(mean(staged.map((night) => pick(night) as number)) as number);
      lines.push(
        `- Average stages per night: light ${stage((n) => n.lightS)}, deep ${stage((n) => n.deepS)}, REM ${stage((n) => n.remS)} (${formatCount(staged.length, 'night')} with stage data).`,
      );
    }
  }

  return {
    context: ['- Sleep: a night belongs to the day it ends on; naps are included.'],
    summary: lines,
    detail: [],
  };
}

/** Average asleep time per night for each Monday-start week; today's finished night counts. */
export function sleepWeeklyColumns(
  prep: Prepared,
  view: PeriodView,
): { headers: string[]; byWeek: ReadonlyMap<DateKey, string[]> } {
  const byWeek = new Map<DateKey, string[]>();
  for (const week of weekStartsIn(view.window)) {
    const nights = nightsIn(prep, weekWithin(week, view.window));
    const average = mean(nights.map((night) => night.asleepS));
    byWeek.set(week, [average === null ? MISSING : formatDuration(average)]);
  }
  return { headers: ['Sleep/night'], byWeek };
}
