import type { DateKey } from '@/domain/time/localDate';

/** A workout planned (or already completed) on a calendar day in the owner's Lyfta schedule. */
export interface ScheduledWorkout {
  lyftaId: string;
  date: DateKey;
  title: string;
  templateId: string | null;
  source: string | null;
  status: string | null;
  completed: boolean;
}
