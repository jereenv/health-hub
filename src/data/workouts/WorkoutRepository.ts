import type { ParsedWorkout } from '@/data/lyfta/parseWorkouts';
import type { Workout } from '@/domain/workouts/types';

/**
 * The only way the sync service and app screens read or write stored workouts,
 * so the storage engine can change without touching them.
 */
export interface WorkoutRepository {
  /** Inserts new workouts and fully replaces existing ones (matched by `lyftaId`), atomically. */
  upsertMany(
    items: readonly ParsedWorkout[],
    syncedAt: string,
  ): Promise<{ inserted: number; updated: number }>;
  /**
   * Deletes workouts performed within [fromIso, toIso] (inclusive) whose id is not in `keepIds`,
   * so workouts removed in Lyfta disappear locally. Returns how many were deleted.
   */
  deleteMissingInRange(fromIso: string, toIso: string, keepIds: readonly number[]): Promise<number>;
  /** Ids of workouts performed within [fromIso, toIso] (inclusive). */
  listIdsInRange(fromIso: string, toIso: string): Promise<number[]>;
  count(): Promise<number>;
  /** Newest first; `beforePerformedAt` is exclusive and pages through history. */
  /** Reads inside one transaction, so a concurrent upsert is never seen half-written. */
  list(p: { limit: number; beforePerformedAt?: string }): Promise<Workout[]>;
  get(lyftaId: number): Promise<Workout | null>;
  /** Every workout, newest first, read as one consistent snapshot. */
  listAll(): Promise<Workout[]>;
  /** Stored raw Lyfta JSON and original sync time of every workout, for local re-parsing. */
  listRaw(): Promise<{ lyftaId: number; rawJson: string; syncedAt: string }[]>;
}
