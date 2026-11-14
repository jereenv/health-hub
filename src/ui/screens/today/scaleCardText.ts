import { formatWeight } from '@/domain/format/units';
import type { OffReason, ScaleErrorKind, ScaleState } from '@/domain/scale/scaleSession';
import type { WeightUnit } from '@/domain/workouts/types';

export type ScaleCardActionKind = 'retry' | 'allow' | 'settings' | 'bluetooth' | 'body';

export interface ScaleCardModel {
  title: string;
  subtitle: string | null;
  /** The weight in the owner's unit. */
  weightText: string | null;
  action: { label: string; kind: ScaleCardActionKind } | null;
  secondary: { label: string; kind: 'retry' } | null;
}

const OFF: Readonly<Record<OffReason, { title: string; action: ScaleCardModel['action'] }>> = {
  permission_needed: {
    title: 'Bluetooth permission needed',
    action: { label: 'Allow Bluetooth', kind: 'allow' },
  },
  permission_blocked: {
    title: 'Bluetooth permission is off',
    action: { label: 'Open settings', kind: 'settings' },
  },
  bluetooth_off: {
    title: 'Bluetooth is off',
    action: { label: 'Turn on Bluetooth', kind: 'bluetooth' },
  },
  unsupported: { title: "This phone can't connect to the scale", action: null },
};

const ERROR_TITLE: Readonly<Record<ScaleErrorKind, string>> = {
  not_found: "Can't find the scale",
  connect_failed: "Couldn't connect to the scale",
  connection_lost: 'Connection lost',
  save_failed: "Couldn't save the weigh-in",
};

/** What the Today weigh-in card shows for a scale state; null when it shows nothing. */
export function buildScaleCardModel(state: ScaleState, unit: WeightUnit): ScaleCardModel | null {
  switch (state.kind) {
    case 'idle':
      return null;
    case 'searching':
    case 'connecting':
      return {
        title: 'Looking for the scale',
        subtitle: 'Step on it to wake it up',
        weightText: null,
        action: null,
        secondary: null,
      };
    case 'waiting':
      return {
        title: 'Step on the scale',
        subtitle: null,
        weightText: null,
        action: null,
        secondary: null,
      };
    case 'live':
      return {
        title: 'Weighing',
        subtitle: state.stable ? 'Stay on · measuring body composition' : 'Settling…',
        weightText: formatWeight(state.weightKg, unit),
        action: null,
        secondary: null,
      };
    case 'saved':
      return {
        title: 'Saved',
        subtitle: null,
        weightText: formatWeight(state.weightKg, unit),
        action: { label: 'See in Body', kind: 'body' },
        secondary: { label: 'Weigh again', kind: 'retry' },
      };
    case 'off':
      return {
        title: OFF[state.reason].title,
        subtitle: null,
        weightText: null,
        action: OFF[state.reason].action,
        secondary: null,
      };
    case 'error':
      return {
        title: ERROR_TITLE[state.error],
        subtitle: null,
        weightText: null,
        action: { label: 'Try again', kind: 'retry' },
        secondary: null,
      };
  }
}
