import type { DecodedFrame } from './frameCodec';
import {
  MAX_AUTO_RECONNECTS,
  MAX_BLE_WEIGHT_KG,
  MAX_SCAN_WINDOWS,
  MIN_BLE_WEIGHT_KG,
} from './protocol';

export type OffReason =
  'unsupported' | 'permission_needed' | 'permission_blocked' | 'bluetooth_off';
export type ScaleErrorKind = 'not_found' | 'connect_failed' | 'connection_lost' | 'save_failed';

export type ScaleState =
  | { kind: 'idle' }
  | { kind: 'off'; reason: OffReason }
  | { kind: 'searching' }
  | { kind: 'connecting' }
  | { kind: 'waiting' }
  | { kind: 'live'; weightKg: number; stable: boolean }
  | { kind: 'saved'; weightKg: number }
  | { kind: 'error'; error: ScaleErrorKind };

export interface ScaleSession {
  ui: ScaleState;
  foreground: boolean;
  reconnects: number;
  scanWindows: number;
  /** Hex of the last fresh result handed to `save`; suppresses the 3 s repeats. */
  savedKey: string | null;
  /** True once `rememberDevice` has been emitted for this run. */
  remembered: boolean;
}

export interface ReadingToSave {
  weightKg: number;
  impedanceOhm: number | null;
  rawPayload: string;
  measuredAt: string;
}

export type ScaleEvent =
  | { type: 'foreground' }
  | { type: 'background' }
  | { type: 'retry' }
  | { type: 'preflight'; result: 'ok' | OffReason }
  | { type: 'found' }
  | { type: 'scanTimedOut' }
  | { type: 'connected' }
  | { type: 'connectFailed' }
  | { type: 'disconnected' }
  | { type: 'frame'; frame: DecodedFrame; at: string }
  | { type: 'saveDone'; outcome: 'saved' | 'duplicate' | 'failed'; weightKg: number };

export type ScaleEffect =
  | { type: 'preflight' }
  | { type: 'scan' }
  | { type: 'stopScan' }
  | { type: 'connect' }
  | { type: 'handshake' }
  | { type: 'disconnect' }
  | { type: 'save'; reading: ReadingToSave }
  | { type: 'rememberDevice' }
  | { type: 'reconnect' };

export const INITIAL_SESSION: ScaleSession = {
  ui: { kind: 'idle' },
  foreground: false,
  reconnects: 0,
  scanWindows: 0,
  savedKey: null,
  remembered: false,
};

interface Step {
  session: ScaleSession;
  effects: ScaleEffect[];
}

const NO_EFFECTS: ScaleEffect[] = [];

function stay(session: ScaleSession): Step {
  return { session, effects: NO_EFFECTS };
}

function withUi(session: ScaleSession, ui: ScaleState, effects: ScaleEffect[] = NO_EFFECTS): Step {
  return { session: { ...session, ui }, effects };
}

function startFresh(): Step {
  return {
    session: { ...INITIAL_SESSION, foreground: true, ui: { kind: 'searching' } },
    effects: [{ type: 'preflight' }],
  };
}

function onFrame(s: ScaleSession, frame: DecodedFrame, at: string): Step {
  const ui = s.ui.kind;
  if (ui !== 'waiting' && ui !== 'live' && ui !== 'saved') return stay(s);

  const effects: ScaleEffect[] = [];
  let session = s;
  if (!s.remembered) {
    session = { ...session, remembered: true };
    effects.push({ type: 'rememberDevice' });
  }

  if (frame.type === 'live') {
    if (s.ui.kind === 'saved' && frame.stable) return { session, effects };
    const savedKey = frame.stable ? session.savedKey : null;
    return {
      session: {
        ...session,
        savedKey,
        ui: { kind: 'live', weightKg: frame.weightKg, stable: frame.stable },
      },
      effects,
    };
  }

  if (frame.type === 'result' && frame.fresh) {
    const inRange = frame.weightKg >= MIN_BLE_WEIGHT_KG && frame.weightKg <= MAX_BLE_WEIGHT_KG;
    if (inRange && session.savedKey !== frame.hex) {
      effects.push({
        type: 'save',
        reading: {
          weightKg: frame.weightKg,
          impedanceOhm: frame.impedanceOhm === 0 ? null : frame.impedanceOhm,
          rawPayload: frame.hex,
          measuredAt: at,
        },
      });
      session = { ...session, savedKey: frame.hex };
    }
  }
  return { session, effects };
}

function onDisconnected(s: ScaleSession): Step {
  if (s.ui.kind !== 'waiting' && s.ui.kind !== 'live') return stay(s);
  if (s.reconnects < MAX_AUTO_RECONNECTS) {
    return {
      session: { ...s, ui: { kind: 'searching' }, reconnects: s.reconnects + 1, scanWindows: 0 },
      effects: [{ type: 'reconnect' }],
    };
  }
  return withUi(s, { kind: 'error', error: 'connection_lost' });
}

function onScanTimedOut(s: ScaleSession): Step {
  if (s.ui.kind !== 'searching') return stay(s);
  if (s.scanWindows + 1 < MAX_SCAN_WINDOWS) {
    return { session: { ...s, scanWindows: s.scanWindows + 1 }, effects: [{ type: 'scan' }] };
  }
  return withUi({ ...s, scanWindows: s.scanWindows + 1 }, { kind: 'error', error: 'not_found' });
}

/** Pure: no timers, no I/O, no mutation. The runner performs the returned effects. */
export function reduceScaleSession(s: ScaleSession, e: ScaleEvent): Step {
  if (e.type === 'foreground') return startFresh();
  if (e.type === 'background') {
    if (!s.foreground) return stay(s);
    return {
      session: { ...s, ui: { kind: 'idle' }, foreground: false },
      effects: [{ type: 'stopScan' }, { type: 'disconnect' }],
    };
  }
  if (e.type === 'saveDone') {
    if (e.outcome === 'failed') return withUi(s, { kind: 'error', error: 'save_failed' });
    return withUi(s, { kind: 'saved', weightKg: e.weightKg });
  }
  if (!s.foreground) return stay(s);

  switch (e.type) {
    case 'retry':
      return startFresh();
    case 'preflight':
      if (s.ui.kind !== 'searching') return stay(s);
      return e.result === 'ok'
        ? { session: s, effects: [{ type: 'scan' }] }
        : withUi(s, { kind: 'off', reason: e.result });
    case 'found':
      if (s.ui.kind !== 'searching') return stay(s);
      return withUi({ ...s, scanWindows: 0 }, { kind: 'connecting' }, [{ type: 'connect' }]);
    case 'scanTimedOut':
      return onScanTimedOut(s);
    case 'connected':
      if (s.ui.kind !== 'connecting') return stay(s);
      return withUi(s, { kind: 'waiting' }, [{ type: 'handshake' }]);
    case 'connectFailed':
      if (s.ui.kind !== 'connecting') return stay(s);
      return withUi(s, { kind: 'error', error: 'connect_failed' });
    case 'disconnected':
      return onDisconnected(s);
    case 'frame':
      return onFrame(s, e.frame, e.at);
  }
}
