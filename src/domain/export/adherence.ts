import type { DateKey } from '@/domain/time/localDate';
import { localDateKey } from '@/domain/time/localDate';
import type { ScheduledWorkout } from '@/domain/workouts/schedule';
import type { Workout } from '@/domain/workouts/types';

import { inWindow } from './period';
import type { DateWindow } from './types';

export interface Adherence {
  scheduled: number;
  done: number;
  missed: number;
  openToday: number;
}

/**
 * Ruling 6. An item dated before today is done when Lyfta marks it completed or a workout was
 * logged that day (the owner logs without ticking); otherwise it is missed. An item dated today
 * that is not done is still open, never missed. Null when no stored item falls in the window.
 */
export function adherence(
  schedule: readonly ScheduledWorkout[],
  workouts: readonly Workout[],
  window: DateWindow,
  today: DateKey,
): Adherence | null {
  const items = schedule.filter((item) => inWindow(item.date, window));
  if (items.length === 0) return null;
  const loggedDays = new Set(workouts.map((workout) => localDateKey(workout.performedAt)));
  const result: Adherence = { scheduled: items.length, done: 0, missed: 0, openToday: 0 };
  for (const item of items) {
    if (item.completed || loggedDays.has(item.date)) result.done += 1;
    else if (item.date === today) result.openToday += 1;
    else if (item.date < today) result.missed += 1;
  }
  return result;
}
