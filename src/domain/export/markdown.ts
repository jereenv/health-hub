import { formatShortDate } from '@/domain/format/dates';
import type { DateKey } from '@/domain/time/localDate';

/** En dash: "no data for this day". Never a zero. */
export const MISSING = '–';

function escapeCell(cell: string): string {
  return cell.replace(/\|/g, '\\|');
}

function row(cells: readonly string[]): string {
  return `| ${cells.map(escapeCell).join(' | ')} |`;
}

/** A GitHub-flavoured Markdown table: header, separator, rows. Nothing is padded. */
export function mdTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string[] {
  return [row(headers), `|${headers.map(() => '---').join('|')}|`, ...rows.map(row)];
}

/** 'Fri 6 Nov'; today gets a trailing '*' (its partial figures are explained in a footnote). */
export function dayLabel(date: DateKey, today: DateKey): string {
  return date === today ? `${formatShortDate(date)}*` : formatShortDate(date);
}

/** The mean, or null for an empty list: an average of nothing is not 0. */
export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** '+1,167' or '−3' with the true minus; '0' for a value that rounds to zero. */
export function formatSignedInteger(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return '0';
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${rounded > 0 ? '+' : '−'}${digits}`;
}
