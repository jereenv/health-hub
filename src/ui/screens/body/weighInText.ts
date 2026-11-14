import { formatRelativeDay } from '@/domain/format/dates';
import type { DateKey } from '@/domain/time/localDate';
import { localDateKey } from '@/domain/time/localDate';

/** "7:12 am" in the phone's zone. */
export function formatClockTime(iso: string): string {
  const at = new Date(iso);
  const hours = at.getHours();
  const minutes = String(at.getMinutes()).padStart(2, '0');
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`;
}

/** "Last weigh-in today, 7:12 am", "yesterday, ..." or "Wed 11 Nov, ...". */
export function lastWeighInText(measuredAt: string, today: DateKey): string {
  const day = formatRelativeDay(localDateKey(measuredAt), today);
  const shown = day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : day;
  return `Last weigh-in ${shown}, ${formatClockTime(measuredAt)}`;
}
