import { parseWeightUnit } from '@/data/lyfta/lyftaUnit';
import {
  parseWorkoutRecord,
  WORKOUT_PARSER_VERSION,
  type ParsedWorkout,
} from '@/data/lyfta/parseWorkouts';
import type { SettingsRepository } from '@/data/settings/SettingsRepository';
import type { WeightUnit } from '@/domain/workouts/types';

import type { WorkoutRepository } from './WorkoutRepository';

/** What the stored workouts were last parsed with; saved as JSON in `lyfta.parsedWith`. */
export interface ParsedWith {
  version: number;
  unit: WeightUnit;
  /** Stored rows that could not be re-parsed at that time; they fail the same way until re-fetched. */
  skipped: number;
}

/** Reads `lyfta.parsedWith`; anything missing, malformed or of the wrong shape counts as unparsed. */
function readParsedWith(value: string | null): ParsedWith | null {
  if (value === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(value);
  } catch {
    return null;
  }
  if (typeof json !== 'object' || json === null) return null;
  const { version, unit, skipped } = json as Record<string, unknown>;
  if (typeof version !== 'number' || (unit !== 'kg' && unit !== 'lb')) return null;
  // Saved before the count existed, or damaged: only `version` and `unit` decide what is current.
  const validSkipped =
    typeof skipped === 'number' && Number.isInteger(skipped) && skipped >= 0 ? skipped : 0;
  return { version, unit, skipped: validSkipped };
}

/**
 * Records that stored workouts count as parsed with the current parser and `unit`, without
 * re-parsing them. Used when a unit change re-downloads the history instead, so no stored
 * `raw_json` is ever read in a unit it was not fetched under.
 */
export async function markWorkoutsParsed(
  settings: SettingsRepository,
  unit: WeightUnit,
  skipped = 0,
): Promise<void> {
  const saved: ParsedWith = { version: WORKOUT_PARSER_VERSION, unit, skipped };
  await settings.set('lyfta.parsedWith', JSON.stringify(saved));
}

/**
 * Re-parses every stored workout from its raw JSON when the parser version or the Lyfta weight
 * unit differs from what they were last parsed with. Needs no network. Returns null when there
 * is nothing to do. A row that cannot be re-parsed keeps its stored data and is counted as
 * skipped. `lyfta.parsedWith` is saved, with the skipped count, once the upserts succeed: the same
 * parser on the same `raw_json` fails the same way every time, so retrying would only repeat the
 * work. A fetch from Lyfta (Re-sync) or a parser version bump is what can fix such a row. A thrown
 * database error leaves it unsaved.
 */
export async function ensureWorkoutsParsed(deps: {
  workouts: WorkoutRepository;
  settings: SettingsRepository;
}): Promise<{ reparsed: number; skipped: number } | null> {
  const unit = parseWeightUnit(await deps.settings.get('lyfta.weightUnit'));
  if (unit === null) return null;

  const current = readParsedWith(await deps.settings.get('lyfta.parsedWith'));
  if (current?.version === WORKOUT_PARSER_VERSION && current.unit === unit) return null;

  // Grouped by original sync time so each row keeps its own.
  const bySyncedAt = new Map<string, ParsedWorkout[]>();
  let reparsed = 0;
  let skipped = 0;
  for (const { rawJson, syncedAt } of await deps.workouts.listRaw()) {
    let parsed: ParsedWorkout | null = null;
    try {
      parsed = parseWorkoutRecord(JSON.parse(rawJson), unit);
    } catch {
      parsed = null;
    }
    if (parsed === null) {
      skipped += 1;
      continue;
    }
    reparsed += 1;
    const group = bySyncedAt.get(syncedAt);
    if (group) group.push(parsed);
    else bySyncedAt.set(syncedAt, [parsed]);
  }

  for (const [syncedAt, items] of bySyncedAt) {
    await deps.workouts.upsertMany(items, syncedAt);
  }
  await markWorkoutsParsed(deps.settings, unit, skipped);
  return { reparsed, skipped };
}
