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
  count(): Promise<number>;
  /** Newest first; `beforePerformedAt` is exclusive and pages through history. */
  list(p: { limit: number; beforePerformedAt?: string }): Promise<Workout[]>;
  get(lyftaId: number): Promise<Workout | null>;
}
