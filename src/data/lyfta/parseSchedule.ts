import { z } from 'zod';

import type { ScheduledWorkout } from '@/domain/workouts/schedule';

import { LyftaError } from './LyftaError';
import { parseLyftaDate } from './parseLyftaDates';
import { parseNumeric } from './parseNumeric';

export interface ParsedScheduledWorkout {
  item: ScheduledWorkout;
  /** The item exactly as Lyfta sent it; `note` and `scheduled_time` live only here. */
  rawJson: string;
}

export interface ParsedSchedulePage {
  items: ParsedScheduledWorkout[];
  /** Items dropped for a missing id or an unreadable date; one bad item must not block a sync. */
  skipped: number;
  currentPage: number;
  totalPages: number;
  /** The envelope's `total_records` (number or numeric string); null when absent or invalid. */
  totalRecords: number | null;
}

const DEFAULT_TITLE = 'Workout';

// Every field is optional and loosely typed; each value is validated by hand below.
const pageSchema = z.object({
  workouts: z.array(z.unknown()),
  current_page: z.unknown().optional(),
  total_pages: z.unknown().optional(),
  total_records: z.unknown().optional(),
});

const itemSchema = z.object({
  id: z.unknown().optional(),
  title: z.unknown().optional(),
  template_id: z.unknown().optional(),
  source: z.unknown().optional(),
  status: z.unknown().optional(),
  scheduled_date: z.unknown().optional(),
  is_completed: z.unknown().optional(),
});

/** Ids arrive as strings or numbers; anything else (or blank) is absent. */
function toIdString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return null;
}

function toText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** A page number: a positive whole number or numeric string, otherwise 1. */
function toPageNumber(value: unknown): number {
  const parsed = parseNumeric(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function parseItem(raw: unknown): ParsedScheduledWorkout | null {
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) return null;
  const fields = parsed.data;

  const lyftaId = toIdString(fields.id);
  // The date is kept as the calendar day Lyfta wrote; no zone conversion can shift it.
  const date = parseLyftaDate(fields.scheduled_date);
  if (lyftaId === null || date === null) return null;

  const title = typeof fields.title === 'string' ? fields.title.trim() : '';
  return {
    item: {
      lyftaId,
      date,
      title: title === '' ? DEFAULT_TITLE : title,
      templateId: toIdString(fields.template_id),
      source: toText(fields.source),
      status: toText(fields.status),
      completed: fields.is_completed === true,
    },
    rawJson: JSON.stringify(raw),
  };
}

/** Parses one page of Lyfta's `GET /schedule`. Throws `invalid_response` without a workouts array. */
export function parseSchedulePage(json: unknown): ParsedSchedulePage {
  const envelope = pageSchema.safeParse(json);
  if (!envelope.success) {
    throw new LyftaError('invalid_response', 'Lyfta schedule response has no workouts array');
  }

  const items: ParsedScheduledWorkout[] = [];
  let skipped = 0;
  for (const raw of envelope.data.workouts) {
    const parsed = parseItem(raw);
    if (parsed === null) {
      skipped += 1;
    } else {
      items.push(parsed);
    }
  }

  return {
    items,
    skipped,
    currentPage: toPageNumber(envelope.data.current_page),
    totalPages: toPageNumber(envelope.data.total_pages),
    totalRecords: parseNumeric(envelope.data.total_records),
  };
}
